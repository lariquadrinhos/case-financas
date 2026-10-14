/**
 * `GET /api/v1/reports/indicators` — Indicadores Financeiros (files_design/01
 * §8.4). Integration test against the real SQLite adapter: happy path,
 * the divisão-por-zero dash (files_design/08 §10), and query validation. No
 * id param, so no not-found path.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { asId, cents, isoDate, month, type CategoryId } from '@/domain/core'
import { getRepositories } from '@/data'
import { seedEntriesFixture, type EntriesTestFixture } from '@/data/fixtures/entries-test-fixtures'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { GET } from './route'

function get(query: string): Request {
  return new Request(`https://x/api/v1/reports/indicators?${query}`)
}

function find(
  indicators: Array<{ key: string; value: number | null }>,
  key: string,
): number | null {
  const indicator = indicators.find((candidate) => candidate.key === key)
  if (indicator === undefined) throw new Error(`indicator ${key} missing from the response`)
  return indicator.value
}

describe('GET /api/v1/reports/indicators', () => {
  let handle: TestRepositories
  let fixture: EntriesTestFixture

  beforeEach(async () => {
    handle = useTestRepositories()
    fixture = await seedEntriesFixture(TEST_USER_ID)
  })

  afterEach(() => {
    handle.teardown()
  })

  it('UC10 — computes margins from the month DRE, and shows a dash (never NaN/Infinity) with no liabilities', async () => {
    const { entryWriter } = getRepositories()
    await entryWriter.create(TEST_USER_ID, {
      kind: 'Revenue',
      amount: cents(1_000_000),
      date: isoDate('2026-07-10'),
      status: 'Paid',
      recurrenceId: null,
      entity: 'PF',
      categoryId: asId<CategoryId>('salario-pro-labore'),
      classification: 'Current',
      bankAccountId: fixture.pfAccountId,
    })
    await entryWriter.create(TEST_USER_ID, {
      kind: 'Expense',
      amount: cents(400_000),
      date: isoDate('2026-07-15'),
      status: 'Paid',
      recurrenceId: null,
      entity: 'PF',
      categoryId: fixture.expenseCategoryId,
      classification: 'Current',
      bankAccountId: fixture.pfAccountId,
    })

    const response = await GET(
      get('month=2026-07&view=Consolidated&statusFilter=Paid&asOf=2026-07-31'),
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      profitability: Array<{ key: string; value: number | null }>
      liquidity: Array<{ key: string; value: number | null }>
    }
    // Lucro Líquido 600.000 / Receita Bruta 1.000.000.
    expect(find(body.profitability, 'netMargin')).toBeCloseTo(60)
    // No liability was registered — Passivo Circulante is zero, so the ratio
    // is undefined and must be `null` (a dash on screen), never `Infinity`.
    expect(find(body.liquidity, 'currentRatio')).toBeNull()
  })

  it('shows a dash for every ratio on a completely empty month, never NaN or Infinity', async () => {
    const response = await GET(
      get('month=2026-01&view=Consolidated&statusFilter=Paid&asOf=2026-01-31'),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      profitability: Array<{ value: number | null }>
      liquidity: Array<{ value: number | null }>
    }
    for (const indicator of [...body.profitability, ...body.liquidity]) {
      if (typeof indicator.value === 'number') {
        expect(Number.isNaN(indicator.value)).toBe(false)
        expect(Number.isFinite(indicator.value)).toBe(true)
      }
    }
  })

  it('UC10 — Eficiência de aporte and Crescimento dos investimentos read the month Destinação do Lucro', async () => {
    const { entryWriter, investmentWriter, profitAllocationWriter } = getRepositories()
    await entryWriter.create(TEST_USER_ID, {
      kind: 'Revenue',
      amount: cents(1_000_000),
      date: isoDate('2026-07-10'),
      status: 'Paid',
      recurrenceId: null,
      entity: 'PF',
      categoryId: asId<CategoryId>('salario-pro-labore'),
      classification: 'Current',
      bankAccountId: fixture.pfAccountId,
    })
    const investment = await investmentWriter.create(TEST_USER_ID, {
      name: 'Tesouro Direto',
      entity: 'PF',
      accumulatedValue: cents(1_100_000),
    })
    // 60.000 in "Aporte em Investimentos" + 40.000 in "Reinvestimento de
    // Dividendos" = 100.000 of aporte; "Consumo Extraordinário" is NOT an
    // aporte and must stay out of both indicators.
    await profitAllocationWriter.save(TEST_USER_ID, {
      month: month('2026-07'),
      netProfit: cents(1_000_000),
      items: {
        InvestmentContribution: [
          {
            destination: { kind: 'Investment', investmentId: investment.id },
            amount: cents(60_000),
          },
        ],
        DividendReinvestment: [
          {
            destination: { kind: 'Investment', investmentId: investment.id },
            amount: cents(40_000),
          },
        ],
        ExtraordinaryConsumption: [
          { destination: { kind: 'FreeText', name: 'Viagem' }, amount: cents(90_000) },
        ],
        CashReserve: [],
      },
    })

    const response = await GET(
      get('month=2026-07&view=Consolidated&statusFilter=Paid&asOf=2026-07-31'),
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      netWorthGrowth: Array<{ key: string; value: number | null }>
      financialQualityOfLife: Array<{ key: string; value: number | null }>
    }
    // 100.000 de aporte / 1.000.000 de Lucro Líquido = 10%.
    expect(find(body.financialQualityOfLife, 'contributionEfficiency')).toBeCloseTo(10)
    // P22, 2026-09-11: o crescimento passou a vir do RETRATO do mês anterior,
    // não de `total − aporte`. Este cenário não grava retrato de junho, então o
    // indicador mostra travessão — que é a resposta certa para "não sei quanto
    // havia antes", e o oposto do número deduzido que ele dava aqui.
    expect(find(body.netWorthGrowth, 'investmentGrowth')).toBeNull()
  })

  /**
   * P22 — o crescimento dos investimentos é MEDIDO, e esta é a prova de que a
   * rota lê o retrato em vez de deduzir.
   *
   * O cenário é o que quebrava a dedução: os investimentos valiam 100.000 no
   * fim de junho e valem 125.000 hoje, dos quais só 5.000 vieram da Destinação
   * do Lucro — os outros 20.000 entraram por um direcionamento de venda
   * (ADR-0017 §4), que não passa por balde nenhum. `total − aporte` daria
   * 4,2%; o retrato dá os 25% reais.
   */
  it('P22 — lê o retrato do mês anterior e mede o crescimento real', async () => {
    const { investmentWriter, profitAllocationWriter, netWorthSnapshotWriter } = getRepositories()
    await investmentWriter.create(TEST_USER_ID, {
      name: 'Investimento Sintético',
      entity: 'PF',
      accumulatedValue: cents(12_500_000),
    })
    await netWorthSnapshotWriter.record(TEST_USER_ID, {
      month: month('2026-06'),
      view: 'Consolidated',
      netWorth: cents(10_000_000),
      investmentsTotal: cents(10_000_000),
      recordedOn: isoDate('2026-06-30'),
    })
    await profitAllocationWriter.save(TEST_USER_ID, {
      month: month('2026-07'),
      netProfit: cents(1_000_000),
      items: {
        InvestmentContribution: [],
        DividendReinvestment: [],
        ExtraordinaryConsumption: [],
        CashReserve: [],
      },
    })

    const response = await GET(
      get('month=2026-07&view=Consolidated&statusFilter=Paid&asOf=2026-07-31'),
    )
    const body = (await response.json()) as {
      netWorthGrowth: Array<{ key: string; value: number | null }>
    }
    expect(find(body.netWorthGrowth, 'investmentGrowth')).toBeCloseTo(25)
  })

  it('rejects a request missing statusFilter with 422', async () => {
    const response = await GET(get('month=2026-07&view=Consolidated&asOf=2026-07-31'))
    expect(response.status).toBe(422)
  })

  it('rejects a request missing asOf with 422', async () => {
    const response = await GET(get('month=2026-07&view=Consolidated&statusFilter=Paid'))
    expect(response.status).toBe(422)
  })
})
