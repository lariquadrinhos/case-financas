/**
 * `GET, PUT /api/v1/discretionary-spending/config` — integration tests
 * against the real SQLite adapter.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { cents } from '@/domain/core'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { GET, PUT } from './route'

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('GET, PUT /api/v1/discretionary-spending/config', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  async function seedAccount() {
    return handle.repositories.bankAccountWriter.create(TEST_USER_ID, {
      label: 'Nubank',
      colour: 'nubank',
      entity: 'PF',
      balance: cents(0),
    })
  }

  it('GET answers 404 before the widget was ever configured — Estado A', async () => {
    const response = await GET(new Request('https://x/api/v1/discretionary-spending/config'))
    expect(response.status).toBe(404)
  })

  it('PUT saves the configuration and GET reads it back', async () => {
    const account = await seedAccount()
    const put = await PUT(
      jsonRequest('https://x/api/v1/discretionary-spending/config', 'PUT', {
        monthlyAmount: 50_000,
        sourceAccountId: account.id,
      }),
    )
    expect(put.status).toBe(200)
    await expect(put.json()).resolves.toEqual({
      monthlyAmount: 50_000,
      sourceAccountId: account.id,
      entity: 'PF',
      allowanceKind: 'Fixed',
    })

    const get = await GET(new Request('https://x/api/v1/discretionary-spending/config'))
    await expect(get.json()).resolves.toMatchObject({ monthlyAmount: 50_000 })
  })

  it('PUT again upserts — "Editar valor e conta" reopens the same singleton', async () => {
    const account = await seedAccount()
    await PUT(
      jsonRequest('https://x/api/v1/discretionary-spending/config', 'PUT', {
        monthlyAmount: 50_000,
        sourceAccountId: account.id,
      }),
    )
    await PUT(
      jsonRequest('https://x/api/v1/discretionary-spending/config', 'PUT', {
        monthlyAmount: 80_000,
        sourceAccountId: account.id,
      }),
    )

    const get = await GET(new Request('https://x/api/v1/discretionary-spending/config'))
    await expect(get.json()).resolves.toMatchObject({ monthlyAmount: 80_000 })
  })

  /**
   * Regression: a `sourceAccountId` naming no Conta Bancária of this user used
   * to reach `handler()` as a raw SQLite FOREIGN KEY error and answer 500. It
   * is the caller naming something absent, so it is a 404
   * (`discretionary_spending.unknown_reference`, src/api/http.ts).
   */
  it('answers 404 when the sourceAccountId names no conta of this user', async () => {
    const response = await PUT(
      jsonRequest('https://x/api/v1/discretionary-spending/config', 'PUT', {
        monthlyAmount: 50_000,
        sourceAccountId: 'does-not-exist',
      }),
    )
    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toBe('application/problem+json')
  })

  it('rejects a negative monthly amount with 422', async () => {
    const account = await seedAccount()
    const response = await PUT(
      jsonRequest('https://x/api/v1/discretionary-spending/config', 'PUT', {
        monthlyAmount: -1,
        sourceAccountId: account.id,
      }),
    )
    expect(response.status).toBe(422)
  })
})
