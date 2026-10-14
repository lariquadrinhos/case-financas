/**
 * Evolução Mensal — the historical series of the DRE's four results and the
 * patrimônio líquido, mês a mês (PRD §1, files_design/01 §8.3).
 *
 * Only the DRE side of a point is a true projection over Lançamentos, exactly
 * like `income-statement.ts`. `netWorth` is not: the Balanço Patrimonial has no
 * history of its own (see `balance-sheet.ts` — account balances, investments
 * and bens materiais are current-state fields the person maintains directly,
 * with no month-tagged log of past values). This module derives each month's
 * ending net worth by walking backward from the CURRENT one, subtracting the
 * net profit earned in every month after it:
 *
 *     PL(mês) = PL(mês seguinte) − LucroLíquido(mês seguinte)
 *
 * which assumes net profit is the only thing that moved the patrimônio líquido
 * between the two months. That holds as long as the person never edits a
 * balance out of band with the DRE — a real limitation, not a fact from any
 * source. See docs/PERGUNTAS-EM-ABERTO.md (P21).
 */

import { type Cents, type Month, type View, addMonths, monthRange, subtract } from '@/domain/core'
import { BLOCK_IDS, type ChartOfAccounts } from '@/domain/chart-of-accounts'
import type { Entry } from '@/domain/entries'
import { computeIncomeStatement } from './income-statement'
import { MONTHLY_TREND_RANGES } from './types'
import type {
  IncomeStatement,
  IncomeStatementRow,
  MonthlyTrend,
  MonthlyTrendPoint,
  MonthlyTrendRange,
} from './types'

const WINDOW_SIZE: Record<MonthlyTrendRange, number> = {
  LastSixMonths: 6,
  LastYear: 12,
}

export interface MonthlyTrendInput {
  readonly view: View
  readonly range: MonthlyTrendRange
  /**
   * The most recent month of the window — "hoje", passed in because the domain
   * never reads a clock (src/domain/README.md).
   */
  readonly until: Month
  readonly entries: readonly Entry[]
  readonly chart: ChartOfAccounts
  /** `BalanceSheet.netWorth` for `view`, computed as of "now" (`until`'s end). */
  readonly currentNetWorth: Cents
  /**
   * P21: o PL fechado de cada mês em que o patrimônio mudou, por mês, para
   * `view`. Mês ausente do mapa é mês em que nada mudou — e por isso HERDA o
   * retrato anterior em vez de ser reconstruído: também é exato.
   *
   * Existe porque o Balanço não tem histórico e nunca vai ter por derivação:
   * `BankAccount.balance` e `Investment.accumulatedValue` só mudam quando a
   * pessoa os edita (medido em 2026-09-09 — pagar um Lançamento não move saldo
   * nenhum). O retrato é gravado nesses momentos; ver
   * `src/data/net-worth-recording.ts`.
   *
   * Vazio para todo mês anterior à existência da tabela, e aí a reconstrução
   * de trás para frente continua valendo, marcada.
   */
  readonly netWorthSnapshots?: ReadonlyMap<Month, Cents>
}

/**
 * files_design/01 §8.3: "mostra apenas os meses com dado real, sem preencher
 * meses vazios com zero". "Real" here has to mean Pago, not "any row" —
 * CLAUDE.md §3 / PRD §5: "um lançamento Previsto é invisível para (...)
 * Evolução Mensal (...) só passa a contar quando vira Pago".
 *
 * `rows` is `income-statement.ts`'s `buildRows`, which deliberately IGNORES
 * `statusFilter` and lists every Lançamento of the month, Pago and Previsto
 * together (it feeds the DRE's "Lançamentos deste mês" table, which shows
 * both by design). Treating any row as "activity" — the previous check —
 * let a Previsto-only month through, and a recorrência's virtual Previsto
 * occurrence is projected into EVERY month of its span, including months
 * long past where nothing was ever paid (`_assemble.ts`
 * `loadProjectedEntriesForMonth`, unconditional on the month). Confirmed live
 * against the seeded dev DB: GET /api/v1/reports/monthly-trend?...&until=
 * 2026-09 returned points for 2026-04 and 2026-08 (revenue/ebitda/netProfit
 * all 0), while `select substr(date,1,7),status from entries` on
 * `.data/bigorna.db` has rows only for 2026-05/06/07 — the open Fixed
 * recorrência "aluguel-moradia" (start 2025-01-05, no término) was filling in
 * every other month with a virtual Previsto.
 */
/**
 * O retrato de `month`, ou o mais recente antes dele. Um mês sem retrato não é
 * um mês desconhecido: é um mês em que o patrimônio não mudou, porque o retrato
 * é gravado exatamente quando ele muda.
 */
function latestSnapshotUpTo(snapshots: ReadonlyMap<Month, Cents>, month: Month): Cents | undefined {
  let best: Month | undefined
  for (const recorded of snapshots.keys()) {
    if (recorded <= month && (best === undefined || recorded > best)) best = recorded
  }
  return best === undefined ? undefined : snapshots.get(best)
}

function hasActivity(rows: readonly IncomeStatementRow[]): boolean {
  return rows.some((row) => row.status === 'Paid')
}

/**
 * Every month the window covers, earliest first. Exported so a caller
 * assembling the input (the route handler) knows exactly which months of
 * `Entry` to fetch, without duplicating `WINDOW_SIZE` — which is private to
 * this module on purpose, the same way `income-statement.ts`'s `CASCADE` is.
 */
export function monthsForRange(range: MonthlyTrendRange, until: Month): readonly Month[] {
  if (!MONTHLY_TREND_RANGES.includes(range)) {
    throw new Error('monthly_trend.invalid_range')
  }
  const earliest = addMonths(until, -(WINDOW_SIZE[range] - 1))
  return monthRange(earliest, until)
}

export function computeMonthlyTrend(input: MonthlyTrendInput): MonthlyTrend {
  const { view, range, until, entries, chart, currentNetWorth } = input
  const snapshots = input.netWorthSnapshots ?? new Map<Month, Cents>()

  const months = monthsForRange(range, until)

  // The Evolução Mensal has no Pago/Previsto toggle of its own (unlike the DRE,
  // Entradas e Saídas and Indicadores) — it reports history, always on Pago
  // (PRD §1 lists the toggle for the other three screens only).
  const statements = months.map((month) =>
    computeIncomeStatement({ entries, chart, view, month, statusFilter: 'Paid' }),
  )

  /**
   * O PL de cada mês, do mais recente para o mais antigo, em três regimes que
   * se sucedem — e o ponto diz em qual dos três ele está (P21):
   *
   *   `until`            o Balanço carregado agora, medido.
   *   mês com retrato    o retrato daquele mês, ou o último anterior a ele:
   *                      mês sem retrato é mês em que o patrimônio não mudou.
   *   antes do primeiro  a reconstrução PL(m) = PL(m+1) − LucroLíquido(m+1),
   *                      que é o único caminho e é marcada como estimativa.
   */
  const netWorthByMonth = new Map<Month, Cents>()
  const measured = new Set<Month>()
  let runningNetWorth = currentNetWorth
  for (let i = months.length - 1; i >= 0; i -= 1) {
    const month = months[i] as Month
    const snapshot = month === until ? undefined : latestSnapshotUpTo(snapshots, month)
    if (snapshot !== undefined) {
      runningNetWorth = snapshot
      measured.add(month)
    } else if (month === until) {
      measured.add(month)
    }
    netWorthByMonth.set(month, runningNetWorth)
    // O passo para trás parte sempre do valor deste mês — inclusive quando ele
    // veio de um retrato, e é por isso que um retrato no meio da janela corrige
    // também os meses anteriores a ele, não só ele mesmo.
    const statement = statements[i]
    if (statement !== undefined) {
      runningNetWorth = subtract(runningNetWorth, statement.netProfit)
    }
  }

  const points: MonthlyTrendPoint[] = []
  months.forEach((month, index) => {
    const statement = statements[index]
    if (statement === undefined) return
    if (!hasActivity(statement.rows)) return

    points.push({
      month,
      revenue: blockAmount(statement, BLOCK_IDS.grossRevenue),
      ebitda: subtotalAmount(statement, 'ebitda'),
      ebit: subtotalAmount(statement, 'ebit'),
      netProfit: statement.netProfit,
      netWorth: netWorthByMonth.get(month) ?? currentNetWorth,
      // P21: verdadeiro só onde não há retrato nenhum até aquele mês — aí o
      // número é a caminhada para trás, uma estimativa, e o campo diz isso.
      netWorthIsReconstructed: !measured.has(month),
    })
  })

  return { view, range, points }
}

/**
 * `computeIncomeStatement` always returns all 13 lines, even for an empty
 * month (income-statement.test.ts: "always returns the 13 lines"), so a miss
 * here means the chart of accounts is missing a fixed block — a stored-data
 * defect, not a case this report should paper over with a silent zero.
 */
function blockAmount(statement: IncomeStatement, key: string): Cents {
  const line = statement.lines.find((l) => l.kind === 'block' && l.key === key)
  if (line === undefined) throw new Error('monthly_trend.missing_block')
  return line.amount
}

function subtotalAmount(statement: IncomeStatement, key: 'ebitda' | 'ebit'): Cents {
  const line = statement.lines.find((l) => l.kind === 'subtotal' && l.key === key)
  if (line === undefined) throw new Error('monthly_trend.missing_subtotal')
  return line.amount
}
