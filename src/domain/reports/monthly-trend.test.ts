import { describe, expect, it } from 'vitest'
import { asId, cents, isoDate, month, ZERO } from '@/domain/core'
import type { BankAccountId, CategoryId, Cents, EntryId } from '@/domain/core'
import { BLOCK_IDS, type ChartOfAccounts } from '@/domain/chart-of-accounts/types'
import { initializeChartOfAccounts } from '@/domain/chart-of-accounts/rules'
import type { Entry } from '@/domain/entries'
import { computeMonthlyTrend } from './monthly-trend'
import type { MonthlyTrendInput } from './monthly-trend'

const CHART: ChartOfAccounts = initializeChartOfAccounts()
const PF_ACCOUNT = asId<BankAccountId>('conta-pf')

function categoryIn(blockKey: keyof typeof BLOCK_IDS): CategoryId {
  const found = CHART.categories.find((c) => c.blockId === BLOCK_IDS[blockKey])
  if (!found) throw new Error(`no default category in block ${blockKey}`)
  return found.id
}

let sequence = 0
const nextId = () => asId<EntryId>(`entry-${(sequence += 1)}`)

function revenue(date: string, amount: Cents): Entry {
  return {
    id: nextId(),
    kind: 'Revenue',
    amount,
    date: isoDate(date),
    status: 'Paid',
    recurrenceId: null,
    entity: 'PJ',
    categoryId: categoryIn('grossRevenue'),
    classification: 'Current',
    bankAccountId: PF_ACCOUNT,
  } as Entry
}

function expense(date: string, amount: Cents): Entry {
  return {
    id: nextId(),
    kind: 'Expense',
    amount,
    date: isoDate(date),
    status: 'Paid',
    recurrenceId: null,
    entity: 'PF',
    categoryId: categoryIn('administrativeExpenses'),
    classification: 'Current',
    bankAccountId: PF_ACCOUNT,
  } as Entry
}

function proLabore(date: string, amount: Cents): Entry {
  return {
    id: nextId(),
    kind: 'ProLabore',
    amount,
    date: isoDate(date),
    status: 'Paid',
    recurrenceId: null,
    categoryId: categoryIn('personalExpenses'),
    classification: 'Current',
    sourceAccountId: asId<BankAccountId>('conta-pj'),
    destinationAccountId: PF_ACCOUNT,
  } as unknown as Entry
}

function baseInput(overrides: Partial<MonthlyTrendInput> = {}): MonthlyTrendInput {
  return {
    view: 'Consolidated',
    range: 'LastSixMonths',
    until: month('2026-07'),
    entries: [],
    chart: CHART,
    currentNetWorth: ZERO,
    ...overrides,
  }
}

/* ------------------------------------------------- files_design/01 §8.3 */

describe('computeMonthlyTrend — only months with real activity are shown', () => {
  it('an account with no entries at all returns no points', () => {
    const trend = computeMonthlyTrend(baseInput())
    expect(trend.points).toEqual([])
  })

  it('skips an empty month sitting between two months with data, no zero filled in', () => {
    const trend = computeMonthlyTrend(
      baseInput({
        entries: [revenue('2026-05-10', cents(100_000)), revenue('2026-07-10', cents(200_000))],
      }),
    )
    // June has no entry: it must be ABSENT, not a point with revenue zero.
    expect(trend.points.map((p) => p.month)).toEqual(['2026-05', '2026-07'])
  })

  it('PRD §5 — Previsto não entra no DRE: a Previsto-only month is absent, not a zero point', () => {
    const planned: Entry = {
      id: nextId(),
      kind: 'Expense',
      amount: cents(50_000),
      date: isoDate('2026-07-05'),
      status: 'Planned',
      recurrenceId: null,
      entity: 'PF',
      categoryId: categoryIn('administrativeExpenses'),
      classification: 'Current',
      bankAccountId: PF_ACCOUNT,
    } as Entry
    // A month with nothing but a Previsto lançamento never becomes real for
    // Evolução Mensal — it only counts once it is Pago (CLAUDE.md §3, PRD §5).
    // Regression for a recorrência's virtual Previsto occurrence, which the
    // engine projects into EVERY month of its span including months the person
    // never touched (src/app/api/v1/reports/_assemble.ts
    // `loadProjectedEntriesForMonth`): that virtual entry looks, from here,
    // exactly like this fixture — a Planned Entry with no Paid counterpart —
    // and used to be enough on its own to light up a "R$ 0,00" point.
    const trend = computeMonthlyTrend(baseInput({ entries: [planned] }))
    expect(trend.points).toEqual([])
  })
})

describe('computeMonthlyTrend — the window respects the range', () => {
  it('LastSixMonths keeps only the 6 months up to and including `until`', () => {
    const trend = computeMonthlyTrend(
      baseInput({
        range: 'LastSixMonths',
        until: month('2026-07'),
        entries: [revenue('2026-01-10', cents(100_000)), revenue('2026-07-10', cents(100_000))],
      }),
    )
    // January 2026 is 6 months before July (Feb, Mar, Apr, May, Jun, Jul is
    // the window) — January itself sits OUTSIDE a 6-month window ending in July.
    expect(trend.points.map((p) => p.month)).toEqual(['2026-07'])
  })

  it('LastYear reaches back 12 months', () => {
    const trend = computeMonthlyTrend(
      baseInput({
        range: 'LastYear',
        until: month('2026-07'),
        entries: [revenue('2025-08-10', cents(100_000)), revenue('2026-07-10', cents(100_000))],
      }),
    )
    expect(trend.points.map((p) => p.month)).toEqual(['2025-08', '2026-07'])
  })

  it('rejects a range outside the closed set', () => {
    // @ts-expect-error — deliberately outside `MonthlyTrendRange` to prove the guard fires.
    expect(() => computeMonthlyTrend(baseInput({ range: 'LastDecade' }))).toThrow(
      'monthly_trend.invalid_range',
    )
  })
})

describe('computeMonthlyTrend — each point mirrors the DRE of that month', () => {
  it('reads revenue, EBITDA, EBIT and net profit off the same cascade the DRE prints', () => {
    const trend = computeMonthlyTrend(
      baseInput({
        entries: [revenue('2026-07-10', cents(1_000_000)), expense('2026-07-12', cents(300_000))],
      }),
    )
    const point = trend.points[0]
    expect(point?.revenue).toBe(1_000_000)
    expect(point?.ebitda).toBe(700_000)
    // D&A is always zero in the MVP (PRD §5): EBIT === EBITDA every month.
    expect(point?.ebit).toBe(point?.ebitda)
    expect(point?.netProfit).toBe(700_000)
  })
})

describe('computeMonthlyTrend — net worth walks backward from the current one', () => {
  it('subtracts each later month’s net profit to reconstruct an earlier month’s net worth', () => {
    // Net worth today (end of July) is 1.000.000. June earned 200.000 and July
    // earned 300.000. PL(June) = PL(July) - LucroLíquido(July) = 700.000.
    // PL(May) = PL(June) - LucroLíquido(June) = 500.000.
    const trend = computeMonthlyTrend(
      baseInput({
        until: month('2026-07'),
        currentNetWorth: cents(1_000_000),
        entries: [revenue('2026-06-10', cents(200_000)), revenue('2026-07-10', cents(300_000))],
      }),
    )
    const june = trend.points.find((p) => p.month === '2026-06')
    const july = trend.points.find((p) => p.month === '2026-07')
    expect(july?.netWorth).toBe(1_000_000)
    expect(june?.netWorth).toBe(700_000)
  })

  it('the most recent point always carries currentNetWorth verbatim', () => {
    const trend = computeMonthlyTrend(
      baseInput({ currentNetWorth: cents(5_000_000), entries: [revenue('2026-07-10', cents(1))] }),
    )
    expect(trend.points.at(-1)?.netWorth).toBe(5_000_000)
  })

  /**
   * P21: só UM ponto da série é medido — o do mês `until`, que carrega o
   * `currentNetWorth` do Balanço verbatim. Todos os anteriores são
   * reconstruídos andando pra trás (`PL(mês) = PL(mês+1) − LucroLíquido(mês+1)`),
   * e essa conta só fecha se o Lucro Líquido tiver sido a ÚNICA coisa que moveu
   * o patrimônio — corrigir à mão o saldo de uma conta quebra a série inteira
   * retroativamente.
   *
   * O ponto medido e o reconstruído eram indistinguíveis no tipo: quem lesse a
   * série não tinha como saber qual número era foto e qual era estimativa.
   */
  it('P21 — marca como reconstruído todo ponto que não é o mês medido', () => {
    const trend = computeMonthlyTrend(
      baseInput({
        until: month('2026-07'),
        currentNetWorth: cents(1_000_000),
        entries: [revenue('2026-06-10', cents(200_000)), revenue('2026-07-10', cents(300_000))],
      }),
    )

    const june = trend.points.find((p) => p.month === '2026-06')
    const july = trend.points.find((p) => p.month === '2026-07')
    expect(july?.netWorthIsReconstructed).toBe(false)
    expect(june?.netWorthIsReconstructed).toBe(true)
  })
})

describe('computeMonthlyTrend — the same entries give three different series', () => {
  it('PJ, PF and Consolidado read different revenue for the same month', () => {
    const entries = [revenue('2026-07-10', cents(1_000_000))]
    const pj = computeMonthlyTrend(baseInput({ view: 'PJ', entries }))
    const pf = computeMonthlyTrend(baseInput({ view: 'PF', entries }))
    expect(pj.points[0]?.revenue).toBe(1_000_000)
    // The PF view has no activity of its own in this scenario — no point at all.
    expect(pf.points).toEqual([])
  })

  /**
   * files_design/07: no gráfico da Evolução Mensal "PF e PJ [são] duas séries
   * agrupadas, que NÃO somam o consolidado porque ele elimina pró-labore e
   * distribuição". A afirmação é visual, mas o que a sustenta é a regra do PRD
   * §5 (eliminação intercompany), e nada travava a soma: uma barra "Consolidado"
   * calculada como PF + PJ passaria em todos os outros testes deste arquivo.
   */
  it('PRD §5 — Eliminação intercompany: o Consolidado NÃO é a soma de PF com PJ', () => {
    const entries = [
      revenue('2026-07-10', cents(1_000_000)),
      proLabore('2026-07-05', cents(400_000)),
    ]
    const pj = computeMonthlyTrend(baseInput({ view: 'PJ', entries }))
    const pf = computeMonthlyTrend(baseInput({ view: 'PF', entries }))
    const consolidated = computeMonthlyTrend(baseInput({ view: 'Consolidated', entries }))

    // Na PJ o pró-labore é despesa, então não aparece na receita.
    expect(pj.points[0]?.revenue).toBe(1_000_000)
    // Na PF o MESMO lançamento é receita.
    expect(pf.points[0]?.revenue).toBe(400_000)
    // E no Consolidado ele some, em vez de somar: 1.000.000, não 1.400.000.
    expect(consolidated.points[0]?.revenue).toBe(1_000_000)
    expect(consolidated.points[0]?.revenue).not.toBe(
      (pj.points[0]?.revenue ?? 0) + (pf.points[0]?.revenue ?? 0),
    )
  })
})

/* --------------------------------------------------------- P21, 2026-09-09 */

describe('computeMonthlyTrend — o retrato mensal do PL (P21)', () => {
  const snapshots = (entries: Array<[string, number]>) =>
    new Map(entries.map(([m, v]) => [month(m), cents(v)]))

  it('um mês com retrato usa o retrato, e deixa de ser reconstrução', () => {
    const trend = computeMonthlyTrend(
      baseInput({
        entries: [revenue('2026-06-10', cents(100_000)), revenue('2026-07-10', cents(100_000))],
        currentNetWorth: cents(1_000_000),
        netWorthSnapshots: snapshots([['2026-06', 900_000]]),
      }),
    )
    const june = trend.points.find((p) => p.month === '2026-06')
    expect(june?.netWorth).toBe(900_000)
    expect(june?.netWorthIsReconstructed).toBe(false)
  })

  it('mês sem retrato HERDA o anterior: mês sem mudança de patrimônio é exato, não estimado', () => {
    const trend = computeMonthlyTrend(
      baseInput({
        entries: [revenue('2026-06-10', cents(100_000)), revenue('2026-07-10', cents(100_000))],
        currentNetWorth: cents(1_000_000),
        netWorthSnapshots: snapshots([['2026-05', 800_000]]),
      }),
    )
    const june = trend.points.find((p) => p.month === '2026-06')
    // Herda maio, e NÃO 1.000.000 − 100.000 da caminhada para trás.
    expect(june?.netWorth).toBe(800_000)
    expect(june?.netWorthIsReconstructed).toBe(false)
  })

  it('antes do primeiro retrato a reconstrução continua, e continua marcada', () => {
    const trend = computeMonthlyTrend(
      baseInput({
        entries: [revenue('2026-06-10', cents(100_000)), revenue('2026-07-10', cents(100_000))],
        currentNetWorth: cents(1_000_000),
        netWorthSnapshots: snapshots([['2026-07', 950_000]]),
      }),
    )
    const june = trend.points.find((p) => p.month === '2026-06')
    // 2026-07 é `until`, que usa o Balanço vivo; junho não tem retrato até ele.
    expect(june?.netWorthIsReconstructed).toBe(true)
    expect(june?.netWorth).toBe(900_000)
  })

  it('sem retrato nenhum, o comportamento é o de antes desta mudança', () => {
    const trend = computeMonthlyTrend(
      baseInput({
        entries: [revenue('2026-06-10', cents(100_000)), revenue('2026-07-10', cents(100_000))],
        currentNetWorth: cents(1_000_000),
      }),
    )
    expect(trend.points.map((p) => [p.month, p.netWorth, p.netWorthIsReconstructed])).toEqual([
      ['2026-06', 900_000, true],
      ['2026-07', 1_000_000, false],
    ])
  })
})
