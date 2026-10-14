/**
 * `GET /api/v1/occurrences?month=` — Revisão de Recorrentes. This route
 * MATERIALISES the month's occurrences on every visit (ADR-0004): the tests
 * cover the happy path, that a second visit does not reset an edited or paid
 * occurrence, and the validation border.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { getRepositories } from '@/data'
import { seedEntriesFixture, type EntriesTestFixture } from '@/data/fixtures/entries-test-fixtures'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { GET } from './route'
import { POST as payOccurrence } from './[id]/payment/route'
import { POST as createEntry } from '../entries/route'

async function createRecurrence(fixture: EntriesTestFixture): Promise<{ id: string }> {
  const { recurrenceWriter } = getRepositories()
  const recurrence = await recurrenceWriter.create(TEST_USER_ID, {
    template: {
      kind: 'Expense',
      amount: 150_000,
      entity: 'PF',
      categoryId: fixture.expenseCategoryId,
      classification: 'Current',
      bankAccountId: fixture.pfAccountId,
    },
    amountKind: 'Fixed',
    startDate: '2026-01-10',
    endsOn: null,
  } as never)
  return { id: recurrence.id }
}

describe('GET /api/v1/occurrences', () => {
  let handle: TestRepositories
  let fixture: EntriesTestFixture

  beforeEach(async () => {
    handle = useTestRepositories()
    fixture = await seedEntriesFixture(TEST_USER_ID)
  })

  afterEach(() => {
    handle.teardown()
  })

  it('starts empty for a month before any série exists', async () => {
    const response = await GET(new Request('https://x/api/v1/occurrences?month=2025-01'))
    await expect(response.json()).resolves.toEqual({ data: [], meta: { total: 0 } })
  })

  it('materialises one occurrence per open série alive in the month', async () => {
    await createRecurrence(fixture)
    const response = await GET(new Request('https://x/api/v1/occurrences?month=2026-07'))
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      data: Array<{ month: string; plannedAmount: number }>
    }
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({
      month: '2026-07',
      plannedAmount: 150_000,
      status: 'Planned',
    })
  })

  it('re-visiting the same month does not reset an occurrence already edited', async () => {
    await createRecurrence(fixture)
    await GET(new Request('https://x/api/v1/occurrences?month=2026-07'))

    const { occurrenceReader, occurrenceWriter } = getRepositories()
    const [first] = await occurrenceReader.listByMonth(TEST_USER_ID, '2026-07' as never)
    await occurrenceWriter.replace(TEST_USER_ID, { ...first!, plannedAmount: 999 as never })

    const second = await GET(new Request('https://x/api/v1/occurrences?month=2026-07'))
    const body = (await second.json()) as { data: Array<{ plannedAmount: number }> }
    expect(body.data[0]?.plannedAmount).toBe(999)
  })

  it('files_design/01 — discarded occurrences are hidden unless includeDiscarded=true', async () => {
    await createRecurrence(fixture)
    await GET(new Request('https://x/api/v1/occurrences?month=2026-07'))
    const { occurrenceReader, occurrenceWriter } = getRepositories()
    const [first] = await occurrenceReader.listByMonth(TEST_USER_ID, '2026-07' as never)
    await occurrenceWriter.replace(TEST_USER_ID, { ...first!, discarded: true })

    const hidden = await GET(new Request('https://x/api/v1/occurrences?month=2026-07'))
    await expect(hidden.json()).resolves.toEqual({ data: [], meta: { total: 0 } })

    const shown = await GET(
      new Request('https://x/api/v1/occurrences?month=2026-07&includeDiscarded=true'),
    )
    const body = (await shown.json()) as { data: unknown[] }
    expect(body.data).toHaveLength(1)
  })

  // ADR-0019: a série agora começa no mês do lançamento, então julho LISTA a
  // ocorrência — mas já paga e apontando para o lançamento. A invariante que
  // este teste guardava continua: pagar de novo não cria um segundo lançamento
  // no mesmo mês (dupla contagem, PRD §5).
  it('ADR-0019 + PRD §5 — o mês do lançamento recorrente aparece já pago, e pagar de novo é recusado', async () => {
    const created = await createEntry(
      new Request('https://x/api/v1/entries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'Expense',
          amount: 150_000,
          date: '2026-07-10',
          categoryId: fixture.expenseCategoryId,
          bankAccountId: fixture.pfAccountId,
          recurrence: { amountKind: 'Fixed', endsOn: null },
        }),
      }),
    )
    expect(created.status).toBe(201)
    const entry = (await created.json()) as { id: string }

    const july = await GET(new Request('https://x/api/v1/occurrences?month=2026-07'))
    const julyBody = (await july.json()) as {
      data: Array<{ id: string; status: string; entryId: string }>
    }
    expect(julyBody.data).toEqual([expect.objectContaining({ status: 'Paid', entryId: entry.id })])

    const occurrenceId = julyBody.data[0]!.id
    const again = await payOccurrence(
      new Request(`https://x/api/v1/occurrences/${occurrenceId}/payment`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paidAmount: 150_000, paymentDate: '2026-07-12' }),
      }),
      { params: Promise.resolve({ id: occurrenceId }) },
    )
    expect(again.status).toBeGreaterThanOrEqual(400)
    const { entryReader } = getRepositories()
    expect(await entryReader.list(TEST_USER_ID)).toHaveLength(1)

    const august = await GET(new Request('https://x/api/v1/occurrences?month=2026-08'))
    const body = (await august.json()) as { data: Array<{ month: string; plannedAmount: number }> }
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({ month: '2026-08', plannedAmount: 150_000 })
  })

  it('a missing month query is 422, not a crash', async () => {
    const response = await GET(new Request('https://x/api/v1/occurrences'))
    expect(response.status).toBe(422)
  })

  it('a badly-formed month is 422', async () => {
    const response = await GET(new Request('https://x/api/v1/occurrences?month=2026-7'))
    expect(response.status).toBe(422)
  })
})
