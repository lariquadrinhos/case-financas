/**
 * `POST /api/v1/recurrences/{id}/closure` — "Encerrar recorrência". Different
 * from "Descartar" (`/api/v1/occurrences/{id}/discard`), which skips a single
 * month: covers the happy path, the not-found path and closing twice.
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
import { GET as occurrencesGET } from '../../../occurrences/route'

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

describe('POST /api/v1/recurrences/{id}/closure', () => {
  let handle: TestRepositories
  let fixture: EntriesTestFixture

  beforeEach(async () => {
    handle = useTestRepositories()
    fixture = await seedEntriesFixture(TEST_USER_ID)
  })

  afterEach(() => {
    handle.teardown()
  })

  async function openRecurrence(): Promise<{ id: string }> {
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

  it('stops the série from closedOn onward', async () => {
    const { id } = await openRecurrence()
    const response = await POST(
      jsonRequest(`https://x/api/v1/recurrences/${id}/closure`, { closedOn: '2026-06-15' }),
      params(id),
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ id, closedOn: '2026-06-15' })
  })

  // Medido em 2026-09-23: encerrar só gravava `closedOn`, e a ocorrência de
  // um mês POSTERIOR que já tinha sido materializada (a Revisão daquele mês foi
  // visitada) continuava na Revisão de Recorrentes — uma série encerrada
  // pedindo pagamento. files_design/04: "Encerrar recorrência" para a série
  // pra sempre.
  it('files_design/04 — ocorrência já materializada depois do encerramento sai da Revisão', async () => {
    const { id } = await openRecurrence()
    await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-08'))

    await POST(
      jsonRequest(`https://x/api/v1/recurrences/${id}/closure`, { closedOn: '2026-06-15' }),
      params(id),
    )

    const response = await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-08'))
    await expect(response.json()).resolves.toMatchObject({ data: [] })
  })

  it('files_design/04 — ocorrência paga antes do encerramento continua (é um lançamento)', async () => {
    const { id } = await openRecurrence()
    await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-05'))
    const { occurrenceReader, occurrenceWriter } = getRepositories()
    const [may] = await occurrenceReader.listByMonth(TEST_USER_ID, '2026-05' as never)
    await occurrenceWriter.replace(TEST_USER_ID, { ...may!, status: 'Paid' })

    await POST(
      jsonRequest(`https://x/api/v1/recurrences/${id}/closure`, { closedOn: '2026-04-01' }),
      params(id),
    )

    const [after] = await occurrenceReader.listByMonth(TEST_USER_ID, '2026-05' as never)
    expect(after).toMatchObject({ status: 'Paid', discarded: false })
  })

  it('404s for an id that does not exist', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/recurrences/none/closure', { closedOn: '2026-06-15' }),
      params('none'),
    )
    expect(response.status).toBe(404)
  })

  it('src/domain/recurrence/engine.ts closeRecurrence — 409 closing an already-closed série', async () => {
    const { id } = await openRecurrence()
    await POST(
      jsonRequest(`https://x/api/v1/recurrences/${id}/closure`, { closedOn: '2026-06-15' }),
      params(id),
    )
    const second = await POST(
      jsonRequest(`https://x/api/v1/recurrences/${id}/closure`, { closedOn: '2026-07-01' }),
      params(id),
    )
    expect(second.status).toBe(409)
  })

  it('422s a malformed body', async () => {
    const { id } = await openRecurrence()
    const response = await POST(
      jsonRequest(`https://x/api/v1/recurrences/${id}/closure`, { closedOn: 'not-a-date' }),
      params(id),
    )
    expect(response.status).toBe(422)
  })
})
