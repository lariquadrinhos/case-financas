/**
 * `POST /api/v1/entries/{id}/payment` — "Marcar Pago" on a standalone
 * Lançamento (files_design/03 "Marcar Pago"). Covers the asymmetry the rule
 * hinges on: pago a menos vs. pago a mais never producing the same shape.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { asId, cents, isoDate, type EntryId } from '@/domain/core'
import { getRepositories } from '@/data'
import { seedEntriesFixture, type EntriesTestFixture } from '@/data/fixtures/entries-test-fixtures'
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

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/v1/entries/{id}/payment', () => {
  let handle: TestRepositories
  let fixture: EntriesTestFixture

  beforeEach(async () => {
    handle = useTestRepositories()
    fixture = await seedEntriesFixture(TEST_USER_ID)
  })

  afterEach(() => {
    handle.teardown()
  })

  async function plannedEntry(): Promise<{ id: string }> {
    const { entryWriter } = getRepositories()
    const entry = await entryWriter.create(TEST_USER_ID, {
      kind: 'Expense',
      amount: cents(150_000),
      date: isoDate('2026-07-10'),
      status: 'Planned',
      recurrenceId: null,
      entity: 'PF',
      categoryId: fixture.expenseCategoryId,
      classification: 'Current',
      bankAccountId: fixture.pfAccountId,
    })
    return { id: entry.id }
  }

  it('an exact payment marks the entry Pago, reports no discrepancy and generates no Evento', async () => {
    const { id } = await plannedEntry()
    const response = await POST(
      jsonRequest(`https://x/api/v1/entries/${id}/payment`, {
        paidAmount: 150_000,
        paymentDate: '2026-07-12',
      }),
      params(id),
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as { entry: { status: string }; outcome: { kind: string } }
    expect(body.entry.status).toBe('Paid')
    expect(body.outcome).toEqual({ kind: 'Exact' })

    const { traceEventReader } = getRepositories()
    expect(await traceEventReader.listRecent(TEST_USER_ID)).toEqual([])
  })

  it('files_design/03 — paying LESS reports Underpaid, logs a Discrepancy Evento and opens a Pendência', async () => {
    const { id } = await plannedEntry()
    const response = await POST(
      jsonRequest(`https://x/api/v1/entries/${id}/payment`, {
        paidAmount: 130_000,
        paymentDate: '2026-07-12',
      }),
      params(id),
    )
    const body = (await response.json()) as { outcome: unknown }
    expect(body.outcome).toEqual({ kind: 'Underpaid', shortfall: 20_000, becomesPending: true })

    const { traceEventReader, paymentDiscrepancyReader } = getRepositories()
    const events = await traceEventReader.listRecent(TEST_USER_ID)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      kind: 'Discrepancy',
      origin: { kind: 'Entry', entryId: id },
      description: expect.stringContaining('divergência') as unknown,
    })

    const discrepancies = await paymentDiscrepancyReader.listByStatus(TEST_USER_ID, 'Pending')
    expect(discrepancies).toHaveLength(1)
    expect(discrepancies[0]).toMatchObject({
      origin: { kind: 'Entry', entryId: id },
      shortfall: 20_000,
      originDate: '2026-07-12',
      status: 'Pending',
    })
  })

  it('files_design/03 — paying MORE reports Overpaid, logs a Discrepancy Evento and never opens a Pendência', async () => {
    const { id } = await plannedEntry()
    const response = await POST(
      jsonRequest(`https://x/api/v1/entries/${id}/payment`, {
        paidAmount: 154_000,
        paymentDate: '2026-07-12',
        overpaymentChoice: 'NoAction',
      }),
      params(id),
    )
    const body = (await response.json()) as { outcome: unknown }
    expect(body.outcome).toEqual({ kind: 'Overpaid', excess: 4_000, becomesPending: false })

    const { traceEventReader, paymentDiscrepancyReader } = getRepositories()
    expect(await traceEventReader.listRecent(TEST_USER_ID)).toHaveLength(1)
    expect(await paymentDiscrepancyReader.listByStatus(TEST_USER_ID, 'Pending')).toEqual([])
  })

  it('404s for an id that does not exist', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/entries/none/payment', {
        paidAmount: 100,
        paymentDate: '2026-07-12',
      }),
      params('none'),
    )
    expect(response.status).toBe(404)
  })

  it('422s a negative paidAmount at the schema border', async () => {
    const { id } = await plannedEntry()
    const response = await POST(
      jsonRequest(`https://x/api/v1/entries/${id}/payment`, {
        paidAmount: -1,
        paymentDate: '2026-07-12',
      }),
      params(id),
    )
    expect(response.status).toBe(422)
  })

  // ADR-0014 — the exact scenario the audit measured: three writes, one unit
  // of work. Before the fix, this test failed with the entry left Paid and no
  // PaymentDiscrepancy — proving the bug, not just asserting the fix.
  it('ADR-0014 — an underpaid payment is all-or-nothing: a failed Pendência write rolls back the entry too', async () => {
    const { id } = await plannedEntry()
    const { paymentDiscrepancyWriter, entryReader, traceEventReader, paymentDiscrepancyReader } =
      getRepositories()

    const boom = new Error('boom — simulated failure of the third write in the unit of work')
    vi.spyOn(paymentDiscrepancyWriter, 'create').mockRejectedValueOnce(boom)

    const response = await POST(
      jsonRequest(`https://x/api/v1/entries/${id}/payment`, {
        paidAmount: 130_000,
        paymentDate: '2026-07-12',
      }),
      params(id),
    )

    // The handler has no code path that turns an unexpected throw into a
    // success response — it propagates, and `handler()` maps it to 500.
    expect(response.status).toBe(500)

    // The whole point: the entry write from the SAME transaction must be gone
    // too, not left half-applied.
    const stillThere = await entryReader.findById(TEST_USER_ID, asId<EntryId>(id))
    expect(stillThere).toMatchObject({ status: 'Planned', amount: 150_000 })
    expect(await traceEventReader.listRecent(TEST_USER_ID)).toEqual([])
    expect(await paymentDiscrepancyReader.listByStatus(TEST_USER_ID, 'Pending')).toEqual([])
  })
})
