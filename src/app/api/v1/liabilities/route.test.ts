/**
 * `GET, POST /api/v1/liabilities` — UC21 (cadastrar uma dívida em andamento).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useTestRepositories, type TestRepositories } from '@/data/fixtures/test-repositories'
import { TEST_USER_ID } from '@/data/fixtures/test-repositories'
import { GET, POST } from './route'

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/v1/liabilities', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  it('UC21 — stores the Passivo, generates the schedule, and logs the Cadastro event', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/liabilities', {
        name: 'Financiamento apartamento',
        creditor: 'Banco X',
        entity: 'PF',
        classification: 'NonCurrent',
        originalAmount: 32000000,
        installmentAmount: 150000,
        installmentCount: 12,
        installmentsAlreadyPaid: 3,
        monthlyInterestRate: 0.008,
        startDate: '2026-01-10',
      }),
    )

    expect(response.status).toBe(201)
    const liability = (await response.json()) as { id: string; installmentCount: number }
    expect(liability.installmentCount).toBe(12)

    const schedule = await handle.repositories.installmentReader.listByLiability(
      TEST_USER_ID,
      liability.id as never,
    )
    expect(schedule).toHaveLength(12)
    // "Parcelas já pagas pré-marcadas" (files_design/03).
    expect(schedule.filter((installment) => installment.status === 'Paid')).toHaveLength(3)

    const events = await handle.repositories.traceEventReader.listByLiability(
      TEST_USER_ID,
      liability.id as never,
    )
    expect(events).toHaveLength(1)
    expect(events[0]?.kind).toBe('Registration')
  })

  /**
   * "Parcelas já pagas" above "Número de parcelas" is a fixable mistake in the
   * form, so it must answer 422. It used to reach the CHECK constraint in
   * schema.ts as a raw driver error and come back 500 — with the Passivo row
   * already written before the failure.
   */
  it('rejects installmentsAlreadyPaid above installmentCount with 422, writing nothing', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/liabilities', {
        name: 'Financiamento',
        creditor: 'Banco X',
        entity: 'PF',
        originalAmount: 1000,
        installmentAmount: 100,
        installmentCount: 5,
        installmentsAlreadyPaid: 9,
        monthlyInterestRate: 0.01,
        startDate: '2026-01-10',
      }),
    )

    expect(response.status).toBe(422)
    await expect(handle.repositories.liabilityReader.list(TEST_USER_ID)).resolves.toHaveLength(0)
  })

  it('rejects a missing startDate with 422', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/liabilities', {
        name: 'x',
        creditor: 'y',
        entity: 'PF',
        originalAmount: 1000,
        installmentAmount: 100,
        installmentCount: 10,
        monthlyInterestRate: 0.01,
      }),
    )
    expect(response.status).toBe(422)
  })
})

describe('GET /api/v1/liabilities', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  it('filters by entity', async () => {
    await POST(
      jsonRequest('https://x/api/v1/liabilities', {
        name: 'Financiamento PF',
        creditor: 'Banco X',
        entity: 'PF',
        originalAmount: 1000000,
        installmentAmount: 100000,
        installmentCount: 10,
        monthlyInterestRate: 0.01,
        startDate: '2026-01-01',
      }),
    )
    await POST(
      jsonRequest('https://x/api/v1/liabilities', {
        name: 'Cartão PJ',
        creditor: 'Banco Y',
        entity: 'PJ',
        originalAmount: 500000,
        installmentAmount: 50000,
        installmentCount: 10,
        monthlyInterestRate: 0.01,
        startDate: '2026-02-01',
      }),
    )

    const pj = await GET(new Request('https://x/api/v1/liabilities?entity=PJ'))
    const body = (await pj.json()) as { data: Array<{ name: string }> }
    expect(body.data).toEqual([expect.objectContaining({ name: 'Cartão PJ' })])
  })
})
