/**
 * `POST /api/v1/liabilities/{id}/rate-adjustments` — UC23, "Registrar
 * Reajuste de Juros".
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { buildInstallmentSchedule } from '@/domain/assets'
import { cents, isoDate } from '@/domain/core'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { POST } from './route'

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function context(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/v1/liabilities/{id}/rate-adjustments', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  async function seedWithSchedule() {
    const liability = await handle.repositories.liabilityWriter.create(TEST_USER_ID, {
      name: 'Financiamento apartamento',
      creditor: 'Banco X',
      entity: 'PF',
      classification: 'NonCurrent',
      originalAmount: cents(32000000),
      installmentAmount: cents(150000),
      installmentCount: 12,
      installmentsAlreadyPaid: 2,
      monthlyInterestRate: 0.008,
      startDate: isoDate('2026-01-10'),
    })
    const schedule = buildInstallmentSchedule(liability)
    await handle.repositories.installmentWriter.replaceSchedule(
      TEST_USER_ID,
      liability.id,
      schedule,
    )
    return { liability, schedule }
  }

  it('recomputes only the Prevista installments from the effective date, keeps paid ones untouched, and logs the event', async () => {
    const { liability, schedule } = await seedWithSchedule()
    const paidInstallments = schedule.filter((installment) => installment.status === 'Paid')

    const response = await POST(
      jsonRequest(`https://x/api/v1/liabilities/${liability.id}/rate-adjustments`, {
        newRate: 0.009,
        effectiveFrom: schedule[2]!.plannedDate,
      }),
      context(liability.id),
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      data: Array<{ id: string; status: string; plannedAmount: number; number: number }>
    }
    expect(body.data).toHaveLength(schedule.length)

    // "Parcelas já pagas nunca são alteradas retroativamente" (files_design/03).
    for (const paid of paidInstallments) {
      const stored = body.data.find((installment) => installment.id === paid.id)
      expect(stored).toMatchObject({ status: 'Paid', plannedAmount: paid.plannedAmount })
    }

    const updatedLiability = await handle.repositories.liabilityReader.findById(
      TEST_USER_ID,
      liability.id,
    )
    expect(updatedLiability?.monthlyInterestRate).toBe(0.009)

    const events = await handle.repositories.traceEventReader.listByLiability(
      TEST_USER_ID,
      liability.id,
    )
    expect(events.some((event) => event.kind === 'RateAdjustment')).toBe(true)

    const adjustments = await handle.repositories.rateAdjustmentReader.listByLiability(
      TEST_USER_ID,
      liability.id,
    )
    expect(adjustments).toEqual([
      { liabilityId: liability.id, newRate: 0.009, effectiveFrom: schedule[2]!.plannedDate },
    ])
  })

  it('answers 404 for a liability that does not exist', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/liabilities/ghost/rate-adjustments', {
        newRate: 0.01,
        effectiveFrom: '2026-05-01',
      }),
      context('ghost'),
    )
    expect(response.status).toBe(404)
  })

  it('rejects a negative rate with 422', async () => {
    const { liability } = await seedWithSchedule()
    const response = await POST(
      jsonRequest(`https://x/api/v1/liabilities/${liability.id}/rate-adjustments`, {
        newRate: -0.01,
        effectiveFrom: '2026-05-01',
      }),
      context(liability.id),
    )
    expect(response.status).toBe(422)
  })
})
