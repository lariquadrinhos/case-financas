/**
 * `POST /api/v1/occurrences/{id}/discard` — "Descartar": skips THIS month
 * only, the série is untouched. Covers the happy path, the not-found path
 * and the conflict of discarding an occurrence already Paga.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { getRepositories } from '@/data'
import { seedEntriesFixture, type EntriesTestFixture } from '@/data/fixtures/entries-test-fixtures'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { POST } from './route'
import { GET as occurrencesGET } from '../../route'

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/v1/occurrences/{id}/discard', () => {
  let handle: TestRepositories
  let fixture: EntriesTestFixture

  beforeEach(async () => {
    handle = useTestRepositories()
    fixture = await seedEntriesFixture(TEST_USER_ID)
  })

  afterEach(() => {
    handle.teardown()
  })

  async function occurrenceIdOf(month: string): Promise<string> {
    const { recurrenceWriter, occurrenceReader } = getRepositories()
    await recurrenceWriter.create(TEST_USER_ID, {
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
    await occurrencesGET(new Request(`https://x/api/v1/occurrences?month=${month}`))
    const [occurrence] = await occurrenceReader.listByMonth(TEST_USER_ID, month as never)
    return occurrence!.id
  }

  it('2026-10-01 — "a série completa" (?closeRecurrence=true): descarta este mês e encerra a série nele', async () => {
    const id = await occurrenceIdOf('2026-07')
    const response = await POST(
      new Request(`https://x/api/v1/occurrences/${id}/discard?closeRecurrence=true`, {
        method: 'POST',
      }),
      params(id),
    )
    expect(response.status).toBe(200)
    const { occurrenceReader, recurrenceReader } = getRepositories()
    const occurrence = await occurrenceReader.findById(TEST_USER_ID, id as never)
    expect(occurrence?.discarded).toBe(true)
    const recurrence = await recurrenceReader.findById(TEST_USER_ID, occurrence!.recurrenceId)
    expect(recurrence?.closedOn).toBe(occurrence?.plannedDate)
    // O mês seguinte não nasce mais.
    await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-08'))
    expect(await occurrenceReader.listByMonth(TEST_USER_ID, '2026-08' as never)).toEqual([])
  })

  it('files_design/04 — skips only this month, the série is untouched', async () => {
    const id = await occurrenceIdOf('2026-07')
    const response = await POST(
      new Request(`https://x/api/v1/occurrences/${id}/discard`, { method: 'POST' }),
      params(id),
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ id, discarded: true })
  })

  it('404s for an id that does not exist', async () => {
    const response = await POST(
      new Request('https://x/api/v1/occurrences/none/discard', { method: 'POST' }),
      params('none'),
    )
    expect(response.status).toBe(404)
  })

  it('src/domain/recurrence/engine.ts discardOccurrence — 409 discarding an occurrence already Paga', async () => {
    const id = await occurrenceIdOf('2026-07')
    const { occurrenceReader, occurrenceWriter } = getRepositories()
    const occurrence = await occurrenceReader.findById(TEST_USER_ID, id as never)
    await occurrenceWriter.replace(TEST_USER_ID, { ...occurrence!, status: 'Paid' })

    const response = await POST(
      new Request(`https://x/api/v1/occurrences/${id}/discard`, { method: 'POST' }),
      params(id),
    )
    expect(response.status).toBe(409)
  })
})
