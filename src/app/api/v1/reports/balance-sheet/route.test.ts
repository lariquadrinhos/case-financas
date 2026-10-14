/**
 * `GET /api/v1/reports/balance-sheet` — Balanço Patrimonial (files_design/01
 * §8.2). Integration test against the real SQLite adapter: happy path across
 * the four groups and query validation. No id param, so no not-found path.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { cents, isoDate } from '@/domain/core'
import { buildInstallmentSchedule } from '@/domain/assets'
import { getRepositories } from '@/data'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { GET } from './route'

function get(query: string): Request {
  return new Request(`https://x/api/v1/reports/balance-sheet?${query}`)
}

describe('GET /api/v1/reports/balance-sheet', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  it('adds bank accounts and investments as current/non-current assets, a liability schedule as a liability, and nets the two', async () => {
    const { bankAccountWriter, investmentWriter, liabilityWriter, installmentWriter } =
      getRepositories()

    await bankAccountWriter.create(TEST_USER_ID, {
      label: 'Conta PF',
      colour: 'banco-do-brasil',
      entity: 'PF',
      balance: cents(1_000_000),
    })
    await investmentWriter.create(TEST_USER_ID, {
      name: 'Tesouro Direto',
      entity: 'PF',
      accumulatedValue: cents(500_000),
    })
    const liability = await liabilityWriter.create(TEST_USER_ID, {
      name: 'Cartão de crédito',
      creditor: 'Banco X',
      entity: 'PF',
      classification: 'Current',
      originalAmount: cents(300_000),
      installmentAmount: cents(100_000),
      installmentCount: 3,
      installmentsAlreadyPaid: 0,
      monthlyInterestRate: 0,
      startDate: isoDate('2026-07-01'),
    })
    await installmentWriter.replaceSchedule(
      TEST_USER_ID,
      liability.id,
      buildInstallmentSchedule(liability),
    )

    const response = await GET(get('view=Consolidated&asOf=2026-07-31'))

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      currentAssets: { total: number }
      nonCurrentAssets: { total: number }
      currentLiabilities: { total: number }
      totalAssets: number
      totalLiabilities: number
      netWorth: number
    }
    expect(body.currentAssets.total).toBe(1_000_000)
    expect(body.nonCurrentAssets.total).toBe(500_000)
    // The outstanding balance is nominal (P5, docs/PERGUNTAS-EM-ABERTO.md): the
    // full 300.000, no interest at 0% a.m., none paid yet.
    expect(body.currentLiabilities.total).toBe(300_000)
    expect(body.totalAssets).toBe(1_500_000)
    expect(body.totalLiabilities).toBe(300_000)
    // "Patrimônio Líquido = Ativos − Passivos" (PRD).
    expect(body.netWorth).toBe(1_200_000)
  })

  it('answers a photo of zero when nothing is registered yet', async () => {
    const response = await GET(get('view=Consolidated&asOf=2026-07-31'))
    expect(response.status).toBe(200)
    const body = (await response.json()) as { netWorth: number }
    expect(body.netWorth).toBe(0)
  })

  it('rejects a request missing asOf with 422', async () => {
    const response = await GET(get('view=Consolidated'))
    expect(response.status).toBe(422)
  })

  it('rejects an unrecognised query field with 422 (.strict())', async () => {
    const response = await GET(get('view=Consolidated&asOf=2026-07-31&month=2026-07'))
    expect(response.status).toBe(422)
  })
})
