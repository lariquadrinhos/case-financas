/**
 * `POST /api/v1/payment-discrepancies/{id}/payment` — "Pagar".
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { cents, isoDate } from '@/domain/core'
import { getRepositories } from '@/data'
import { seedEntriesFixture, type EntriesTestFixture } from '@/data/fixtures/entries-test-fixtures'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { POST } from './route'

function postRequest(url: string): Request {
  return new Request(url, { method: 'POST' })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/v1/payment-discrepancies/{id}/payment', () => {
  let handle: TestRepositories
  let fixture: EntriesTestFixture

  beforeEach(async () => {
    handle = useTestRepositories()
    fixture = await seedEntriesFixture(TEST_USER_ID)
  })

  afterEach(() => {
    handle.teardown()
  })

  async function pendingDiscrepancy(): Promise<{ id: string }> {
    const { entryWriter, paymentDiscrepancyWriter } = getRepositories()
    const entry = await entryWriter.create(TEST_USER_ID, {
      kind: 'Expense',
      amount: cents(80_000),
      date: isoDate('2026-07-12'),
      status: 'Paid',
      recurrenceId: null,
      entity: 'PF',
      categoryId: fixture.expenseCategoryId,
      classification: 'Current',
      bankAccountId: fixture.pfAccountId,
    })
    const discrepancy = await paymentDiscrepancyWriter.create(TEST_USER_ID, {
      origin: { kind: 'Entry', entryId: entry.id },
      shortfall: cents(20_000),
      originDate: isoDate('2026-07-12'),
      status: 'Pending',
    })
    return { id: discrepancy.id }
  }

  it('resolves a Pending discrepancy', async () => {
    const { id } = await pendingDiscrepancy()
    const response = await POST(
      postRequest(`https://x/api/v1/payment-discrepancies/${id}/payment`),
      params(id),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { status: string }
    expect(body.status).toBe('Resolved')
  })

  /**
   * P25 (produto, 2026-09-08). "Pagar" resolvia a Pendência e mais nada, então
   * a diferença efetivamente paga não aparecia em lugar nenhum: o DRE ficava
   * curto por ela para sempre. A decisão seguiu a P6 — se a parcela de Passivo
   * paga conta no DRE, o complemento de um pagamento a menor também conta.
   *
   * O Lançamento novo herda categoria, entidade, classificação e conta do de
   * origem (é o mesmo gasto sendo completado) e nasce Pago, com a data de HOJE
   * e não a original: regime de caixa (PRD §5), e usar a data original
   * reescreveria um mês que a pessoa já fechou.
   */
  it('P25 — registra a diferença como Lançamento, herdando o de origem', async () => {
    const { id } = await pendingDiscrepancy()
    const { entryReader } = getRepositories()
    const antes = await entryReader.list(TEST_USER_ID)

    await POST(postRequest(`https://x/api/v1/payment-discrepancies/${id}/payment`), params(id))

    const depois = await entryReader.list(TEST_USER_ID)
    expect(depois.length).toBe(antes.length + 1)

    const novo = depois.find((e) => !antes.some((a) => a.id === e.id))
    expect(novo).toBeDefined()
    expect(novo?.amount).toBe(20_000)
    expect(novo?.status).toBe('Paid')
    expect(novo && 'categoryId' in novo ? novo.categoryId : null).toBe(fixture.expenseCategoryId)
    // Data de hoje, não a originDate de 2026-07-12 — senão o mês fechado muda.
    expect(novo?.date).not.toBe('2026-07-12')
  })

  it('404s for an id that does not exist', async () => {
    const response = await POST(
      postRequest('https://x/api/v1/payment-discrepancies/none/payment'),
      params('none'),
    )
    expect(response.status).toBe(404)
  })

  it('409s a discrepancy that is already Resolved', async () => {
    const { id } = await pendingDiscrepancy()
    await POST(postRequest(`https://x/api/v1/payment-discrepancies/${id}/payment`), params(id))

    const response = await POST(
      postRequest(`https://x/api/v1/payment-discrepancies/${id}/payment`),
      params(id),
    )
    expect(response.status).toBe(409)
  })
})
