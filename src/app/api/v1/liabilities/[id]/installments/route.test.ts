/**
 * `GET /api/v1/liabilities/{id}/installments`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { cents, isoDate } from '@/domain/core'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { GET } from './route'

function context(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('GET /api/v1/liabilities/{id}/installments', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  it('lists the generated schedule for a Passivo', async () => {
    const liability = await handle.repositories.liabilityWriter.create(TEST_USER_ID, {
      name: 'Financiamento apartamento',
      creditor: 'Banco X',
      entity: 'PF',
      classification: 'NonCurrent',
      originalAmount: cents(32000000),
      installmentAmount: cents(150000),
      installmentCount: 3,
      installmentsAlreadyPaid: 0,
      monthlyInterestRate: 0.008,
      startDate: isoDate('2026-01-10'),
    })
    const schedule = [1, 2, 3].map((number) => ({
      id: `${liability.id}#${number}` as never,
      liabilityId: liability.id,
      number,
      plannedDate: isoDate('2026-01-10'),
      plannedAmount: cents(100000),
      status: 'Planned' as const,
      paidAmount: null,
      paidDate: null,
      discarded: false,
    }))
    await handle.repositories.installmentWriter.replaceSchedule(
      TEST_USER_ID,
      liability.id,
      schedule,
    )

    const response = await GET(
      new Request(`https://x/api/v1/liabilities/${liability.id}/installments`),
      context(liability.id),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: unknown[]; meta: { total: number } }
    expect(body.data).toHaveLength(3)
    expect(body.meta.total).toBe(3)
  })

  it('answers 404 for a liability that does not exist', async () => {
    const response = await GET(
      new Request('https://x/api/v1/liabilities/ghost/installments'),
      context('ghost'),
    )
    expect(response.status).toBe(404)
  })
})
