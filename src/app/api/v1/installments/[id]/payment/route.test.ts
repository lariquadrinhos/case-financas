/**
 * `POST /api/v1/installments/{id}/payment` — "Marcar Paga" (UC24).
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

describe('POST /api/v1/installments/{id}/payment', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  async function seedFirstInstallment() {
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
    const schedule = await handle.repositories.installmentWriter.replaceSchedule(
      TEST_USER_ID,
      liability.id,
      buildInstallmentSchedule(liability),
    )
    return { liability, first: schedule[0]! }
  }

  it('pays exactly the planned amount and logs "valor conforme previsto"', async () => {
    const { first } = await seedFirstInstallment()
    const response = await POST(
      jsonRequest(`https://x/api/v1/installments/${first.id}/payment`, {
        paidAmount: first.plannedAmount,
        paymentDate: '2026-02-10',
      }),
      context(first.id),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      status: 'Paid',
      paidAmount: first.plannedAmount,
    })

    const events = await handle.repositories.traceEventReader.listRecent(TEST_USER_ID)
    expect(events[0]).toMatchObject({
      kind: 'InstallmentPaid',
      description: expect.stringContaining('conforme previsto'),
    })
  })

  it('a divergent payment is still accepted and worded differently, with no Pendência (UC24)', async () => {
    const { first } = await seedFirstInstallment()
    const response = await POST(
      jsonRequest(`https://x/api/v1/installments/${first.id}/payment`, {
        paidAmount: first.plannedAmount + 2000,
        paymentDate: '2026-02-10',
      }),
      context(first.id),
    )

    expect(response.status).toBe(200)
    const events = await handle.repositories.traceEventReader.listRecent(TEST_USER_ID)
    expect(events[0]?.description).toContain('previsto')
    expect(events[0]?.description).toContain('pago')

    // Unlike a Lançamento's divergence, this never creates a Pendência.
    expect(
      await handle.repositories.pendingAllocationReader.listByStatus(TEST_USER_ID, 'Pending'),
    ).toEqual([])
  })

  it('refuses to pay an already-paid installment (409)', async () => {
    const { first } = await seedFirstInstallment()
    await POST(
      jsonRequest(`https://x/api/v1/installments/${first.id}/payment`, {
        paidAmount: first.plannedAmount,
        paymentDate: '2026-02-10',
      }),
      context(first.id),
    )

    const secondAttempt = await POST(
      jsonRequest(`https://x/api/v1/installments/${first.id}/payment`, {
        paidAmount: first.plannedAmount,
        paymentDate: '2026-02-11',
      }),
      context(first.id),
    )
    expect(secondAttempt.status).toBe(409)
    await expect(secondAttempt.json()).resolves.toMatchObject({
      code: 'installment_payment.already_paid',
    })
  })

  it('answers 404 for an installment that does not exist', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/installments/ghost/payment', {
        paidAmount: 100,
        paymentDate: '2026-02-10',
      }),
      context('ghost'),
    )
    expect(response.status).toBe(404)
  })
})
