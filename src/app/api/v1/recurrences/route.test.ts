/**
 * `GET, POST /api/v1/recurrences` — integration tests against the real SQLite
 * adapter (`useTestRepositories`), per `src/api/README.md`: happy path,
 * validation, and the `includeClosed` filter.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { seedEntriesFixture, type EntriesTestFixture } from '@/data/fixtures/entries-test-fixtures'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { getRepositories } from '@/data'
import { closeRecurrence } from '@/domain/recurrence'
import { GET, POST } from './route'

function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
  })
}

describe('POST /api/v1/recurrences', () => {
  let handle: TestRepositories
  let fixture: EntriesTestFixture

  beforeEach(async () => {
    handle = useTestRepositories()
    fixture = await seedEntriesFixture(TEST_USER_ID)
  })

  afterEach(() => {
    handle.teardown()
  })

  it('creates a série and answers 201 with a Location header', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/recurrences', 'POST', {
        template: {
          kind: 'Expense',
          amount: 150_000,
          categoryId: fixture.expenseCategoryId,
          bankAccountId: fixture.pfAccountId,
        },
        amountKind: 'Fixed',
        startDate: '2026-01-10',
      }),
    )

    expect(response.status).toBe(201)
    expect(response.headers.get('location')).toMatch(/^\/api\/v1\/recurrences\/.+/)
    const body = (await response.json()) as {
      id: string
      amountKind: string
      startDate: string
      endsOn: string | null
      closedOn: string | null
    }
    expect(body).toMatchObject({ amountKind: 'Fixed', startDate: '2026-01-10', closedOn: null })
    expect(body.id).toBeTruthy()
  })

  it('files_design/03 — "a definir" needs no amount in the template', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/recurrences', 'POST', {
        template: {
          kind: 'Expense',
          amount: 0,
          categoryId: fixture.expenseCategoryId,
          bankAccountId: fixture.pfAccountId,
        },
        amountKind: 'ToBeDefined',
        startDate: '2026-01-10',
        endsOn: '2026-12-10',
      }),
    )
    expect(response.status).toBe(201)
    const body = (await response.json()) as { amountKind: string; endsOn: string | null }
    expect(body).toMatchObject({ amountKind: 'ToBeDefined', endsOn: '2026-12-10' })
  })

  it('rejects an unknown field with 422 instead of dropping it silently', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/recurrences', 'POST', {
        template: {
          kind: 'Expense',
          amount: 1000,
          categoryId: fixture.expenseCategoryId,
          bankAccountId: fixture.pfAccountId,
        },
        startDate: '2026-01-10',
        rogue: true,
      }),
    )
    expect(response.status).toBe(422)
  })

  it('audit — a template naming a categoria that does not exist is 404, not 500', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/recurrences', 'POST', {
        template: {
          kind: 'Expense',
          amount: 1000,
          categoryId: 'categoria-que-nao-existe',
          bankAccountId: fixture.pfAccountId,
        },
        amountKind: 'Fixed',
        startDate: '2026-01-10',
      }),
    )
    expect(response.status).toBe(404)
    const body = (await response.json()) as { code: string; detail: string }
    expect(body.code).toBe('recurrence.unknown_reference')
    expect(body.detail).not.toMatch(/SQLITE|insert |select /i)
  })

  it('rejects a malformed body with 400, not 422', async () => {
    const response = await POST(
      new Request('https://x/api/v1/recurrences', {
        method: 'POST',
        body: 'not json',
        headers: { 'content-type': 'application/json' },
      }),
    )
    expect(response.status).toBe(400)
  })
})

describe('GET /api/v1/recurrences', () => {
  let handle: TestRepositories
  let fixture: EntriesTestFixture

  beforeEach(async () => {
    handle = useTestRepositories()
    fixture = await seedEntriesFixture(TEST_USER_ID)
  })

  afterEach(() => {
    handle.teardown()
  })

  it('starts empty for a fresh account', async () => {
    const response = await GET(new Request('https://x/api/v1/recurrences'))
    await expect(response.json()).resolves.toEqual({ data: [], meta: { total: 0 } })
  })

  it('by default lists only OPEN séries, and includeClosed=true also lists closed ones', async () => {
    const { recurrenceWriter } = getRepositories()
    const open = await recurrenceWriter.create(TEST_USER_ID, {
      template: {
        kind: 'Expense',
        amount: 1000,
        entity: 'PF',
        categoryId: fixture.expenseCategoryId,
        classification: 'Current',
        bankAccountId: fixture.pfAccountId,
      },
      amountKind: 'Fixed',
      startDate: '2026-01-10',
      endsOn: null,
    } as never)
    const toClose = await recurrenceWriter.create(TEST_USER_ID, {
      template: {
        kind: 'Expense',
        amount: 2000,
        entity: 'PF',
        categoryId: fixture.expenseCategoryId,
        classification: 'Current',
        bankAccountId: fixture.pfAccountId,
      },
      amountKind: 'Fixed',
      startDate: '2026-01-10',
      endsOn: null,
    } as never)
    await recurrenceWriter.replace(TEST_USER_ID, closeRecurrence(toClose, '2026-02-01' as never))

    const onlyOpen = await GET(new Request('https://x/api/v1/recurrences'))
    const openBody = (await onlyOpen.json()) as { data: Array<{ id: string }> }
    expect(openBody.data.map((r) => r.id)).toEqual([open.id])

    const all = await GET(new Request('https://x/api/v1/recurrences?includeClosed=true'))
    const allBody = (await all.json()) as { meta: { total: number } }
    expect(allBody.meta.total).toBe(2)
  })

  it('an unknown query param is 422, not silently dropped', async () => {
    const response = await GET(new Request('https://x/api/v1/recurrences?rogue=true'))
    expect(response.status).toBe(422)
  })
})
