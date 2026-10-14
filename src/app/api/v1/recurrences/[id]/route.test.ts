/**
 * `GET /api/v1/recurrences/{id}` — integration tests against the real SQLite
 * adapter: happy path and the not-found path.
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

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('GET /api/v1/recurrences/{id}', () => {
  let handle: TestRepositories
  let fixture: EntriesTestFixture

  beforeEach(async () => {
    handle = useTestRepositories()
    fixture = await seedEntriesFixture(TEST_USER_ID)
  })

  afterEach(() => {
    handle.teardown()
  })

  async function createRecurrence(): Promise<{ id: string }> {
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

  it('reads a stored série', async () => {
    const { id } = await createRecurrence()
    const response = await GET(new Request(`https://x/api/v1/recurrences/${id}`), params(id))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ id, amountKind: 'Fixed' })
  })

  it('404s for an id that does not exist', async () => {
    const response = await GET(new Request('https://x/api/v1/recurrences/none'), params('none'))
    expect(response.status).toBe(404)
  })
})
