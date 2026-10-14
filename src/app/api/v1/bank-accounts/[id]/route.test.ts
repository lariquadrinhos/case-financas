/**
 * `GET, PATCH, DELETE /api/v1/bank-accounts/{id}`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { cents } from '@/domain/core'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { DELETE, GET, PATCH } from './route'

function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
  })
}

function context(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('GET, PATCH, DELETE /api/v1/bank-accounts/{id}', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  async function seedAccount() {
    const { bankAccountWriter } = handle.repositories
    return bankAccountWriter.create(TEST_USER_ID, {
      label: 'Nubank',
      colour: 'nubank',
      entity: 'PF',
      balance: cents(150000),
    })
  }

  it('GET reads the account back', async () => {
    const account = await seedAccount()
    const response = await GET(
      new Request(`https://x/api/v1/bank-accounts/${account.id}`),
      context(account.id),
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ label: 'Nubank' })
  })

  it('GET answers 404 for an id that does not exist', async () => {
    const response = await GET(
      new Request('https://x/api/v1/bank-accounts/ghost'),
      context('ghost'),
    )
    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ code: 'resource.not_found' })
  })

  it('PATCH changes only the given fields', async () => {
    const account = await seedAccount()
    const response = await PATCH(
      jsonRequest(`https://x/api/v1/bank-accounts/${account.id}`, 'PATCH', { balance: 999900 }),
      context(account.id),
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      label: 'Nubank',
      colour: 'nubank',
      balance: 999900,
    })
  })

  it('PATCH answers 404 for an id that does not exist', async () => {
    const response = await PATCH(
      jsonRequest('https://x/api/v1/bank-accounts/ghost', 'PATCH', { balance: 1 }),
      context('ghost'),
    )
    expect(response.status).toBe(404)
  })

  it('PATCH rejects an unknown field', async () => {
    const account = await seedAccount()
    const response = await PATCH(
      jsonRequest(`https://x/api/v1/bank-accounts/${account.id}`, 'PATCH', { rogue: 1 }),
      context(account.id),
    )
    expect(response.status).toBe(422)
  })

  it('DELETE removes an unreferenced account', async () => {
    const account = await seedAccount()
    const response = await DELETE(
      new Request(`https://x/api/v1/bank-accounts/${account.id}`, { method: 'DELETE' }),
      context(account.id),
    )
    expect(response.status).toBe(204)

    const after = await GET(
      new Request(`https://x/api/v1/bank-accounts/${account.id}`),
      context(account.id),
    )
    expect(after.status).toBe(404)
  })

  it('DELETE answers 404 for an id that does not exist', async () => {
    const response = await DELETE(
      new Request('https://x/api/v1/bank-accounts/ghost', { method: 'DELETE' }),
      context('ghost'),
    )
    expect(response.status).toBe(404)
  })

  it('ADR-0012 §2 — DELETE answers 409 while the account is still referenced', async () => {
    const account = await seedAccount()
    // The discretionary spending config is the smallest FK to a bank account
    // (schema.ts) — enough to trip RESTRICT without the entries repository.
    await handle.repositories.discretionarySpendingConfigWriter.save(TEST_USER_ID, {
      monthlyAmount: cents(50000),
      sourceAccountId: account.id,
      entity: 'PF',
    })

    const response = await DELETE(
      new Request(`https://x/api/v1/bank-accounts/${account.id}`, { method: 'DELETE' }),
      context(account.id),
    )
    expect(response.status).toBe(409)
  })
})
