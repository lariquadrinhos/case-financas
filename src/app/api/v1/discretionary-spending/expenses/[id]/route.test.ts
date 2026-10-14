/**
 * `PATCH, DELETE /api/v1/discretionary-spending/expenses/{id}` — editing a
 * gasto from the widget's own history (Estado C).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_BLOCKS, DEFAULT_CATEGORIES } from '@/domain/chart-of-accounts'
import { cents, isoDate } from '@/domain/core'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { DELETE, PATCH } from './route'

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

describe('PATCH, DELETE /api/v1/discretionary-spending/expenses/{id}', () => {
  let handle: TestRepositories

  beforeEach(async () => {
    handle = useTestRepositories()
    await handle.repositories.statementBlockWriter.seed(TEST_USER_ID, DEFAULT_BLOCKS)
    await handle.repositories.categoryWriter.seed(TEST_USER_ID, DEFAULT_CATEGORIES)
    const account = await handle.repositories.bankAccountWriter.create(TEST_USER_ID, {
      label: 'Nubank',
      colour: 'nubank',
      entity: 'PF',
      balance: cents(0),
    })
    await handle.repositories.discretionarySpendingConfigWriter.save(TEST_USER_ID, {
      monthlyAmount: cents(50_000),
      sourceAccountId: account.id,
      entity: 'PF',
    })
  })

  afterEach(() => {
    handle.teardown()
  })

  async function seedExpense() {
    return handle.repositories.discretionaryExpenseWriter.create(TEST_USER_ID, {
      date: isoDate('2026-07-12'),
      amount: cents(4_500),
      label: null,
    })
  }

  it('PATCH edits the amount and leaves the label untouched when omitted', async () => {
    const expense = await seedExpense()
    const response = await PATCH(
      jsonRequest(`https://x/api/v1/discretionary-spending/expenses/${expense.id}`, 'PATCH', {
        amount: 6_000,
      }),
      context(expense.id),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ amount: 6_000, label: null })
  })

  it('PATCH can set a label — the one field this flow keeps (files_design/03)', async () => {
    const expense = await seedExpense()
    const response = await PATCH(
      jsonRequest(`https://x/api/v1/discretionary-spending/expenses/${expense.id}`, 'PATCH', {
        label: 'Mercado',
      }),
      context(expense.id),
    )
    await expect(response.json()).resolves.toMatchObject({ amount: 4_500, label: 'Mercado' })
  })

  it('PATCH answers 404 for a gasto that does not exist', async () => {
    const response = await PATCH(
      jsonRequest('https://x/api/v1/discretionary-spending/expenses/ghost', 'PATCH', {
        amount: 1_000,
      }),
      context('ghost'),
    )
    expect(response.status).toBe(404)
  })

  it('DELETE removes the gasto and answers 204', async () => {
    const expense = await seedExpense()
    const response = await DELETE(
      jsonRequest(`https://x/api/v1/discretionary-spending/expenses/${expense.id}`, 'DELETE'),
      context(expense.id),
    )
    expect(response.status).toBe(204)

    const stillThere = await handle.repositories.discretionaryExpenseReader.findById(
      TEST_USER_ID,
      expense.id,
    )
    expect(stillThere).toBeNull()
  })

  it('DELETE on an absent gasto is not an error (idempotent remove)', async () => {
    const response = await DELETE(
      jsonRequest('https://x/api/v1/discretionary-spending/expenses/ghost', 'DELETE'),
      context('ghost'),
    )
    expect(response.status).toBe(204)
  })
})
