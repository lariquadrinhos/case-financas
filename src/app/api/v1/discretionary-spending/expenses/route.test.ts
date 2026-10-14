/**
 * `GET, POST /api/v1/discretionary-spending/expenses` — integration tests
 * against the real SQLite adapter.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { BLOCK_IDS, DEFAULT_BLOCKS, DEFAULT_CATEGORIES } from '@/domain/chart-of-accounts'
import { cents } from '@/domain/core'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { GET, POST } from './route'
import { GET as getEntry, PATCH as patchEntry } from '../../entries/[id]/route'

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('GET, POST /api/v1/discretionary-spending/expenses', () => {
  let handle: TestRepositories

  beforeEach(async () => {
    handle = useTestRepositories()
    // A real Onboarding seeds the whole Plano de Contas; the widget's Lançamento
    // only needs the fixed "Consumo Livre" category to exist for the FK.
    await handle.repositories.statementBlockWriter.seed(TEST_USER_ID, DEFAULT_BLOCKS)
    await handle.repositories.categoryWriter.seed(TEST_USER_ID, DEFAULT_CATEGORIES)
  })

  afterEach(() => {
    handle.teardown()
  })

  async function configureWidget() {
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
  }

  it('POST asks for the amount and date only — no category, no account, no entity', async () => {
    await configureWidget()
    const response = await POST(
      jsonRequest('https://x/api/v1/discretionary-spending/expenses', {
        amount: 4_500,
        date: '2026-07-12',
      }),
    )

    expect(response.status).toBe(201)
    expect(response.headers.get('location')).toMatch(
      /^\/api\/v1\/discretionary-spending\/expenses\/.+/,
    )
    await expect(response.json()).resolves.toMatchObject({
      amount: 4_500,
      date: '2026-07-12',
      label: null,
    })
  })

  it('answers 409 before the widget was configured — nowhere to post the Lançamento', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/discretionary-spending/expenses', {
        amount: 1_000,
        date: '2026-07-12',
      }),
    )
    expect(response.status).toBe(409)
  })

  it('rejects a negative amount with 422', async () => {
    await configureWidget()
    const response = await POST(
      jsonRequest('https://x/api/v1/discretionary-spending/expenses', {
        amount: -1,
        date: '2026-07-12',
      }),
    )
    expect(response.status).toBe(422)
  })

  it('GET lists only the gastos of the requested month', async () => {
    await configureWidget()
    await POST(
      jsonRequest('https://x/api/v1/discretionary-spending/expenses', {
        amount: 1_000,
        date: '2026-07-05',
      }),
    )
    await POST(
      jsonRequest('https://x/api/v1/discretionary-spending/expenses', {
        amount: 2_000,
        date: '2026-08-01',
      }),
    )

    const response = await GET(
      new Request('https://x/api/v1/discretionary-spending/expenses?month=2026-07'),
    )
    const body = (await response.json()) as {
      data: Array<{ amount: number }>
      meta: { total: number }
    }
    expect(body.meta.total).toBe(1)
    expect(body.data[0]?.amount).toBe(1_000)
  })

  it('GET rejects a malformed month with 422', async () => {
    const response = await GET(
      new Request('https://x/api/v1/discretionary-spending/expenses?month=not-a-month'),
    )
    expect(response.status).toBe(422)
  })

  it('dono 2026-10-06 — editar um gasto de Consumo Livre para outra categoria o tira do widget e mantém o lançamento', async () => {
    await configureWidget()
    const created = (await (
      await POST(
        jsonRequest('https://x/api/v1/discretionary-spending/expenses', {
          amount: 4_500,
          date: '2026-07-12',
        }),
      )
    ).json()) as { id: string }
    const outra = DEFAULT_CATEGORIES.find(
      (c) => !c.isSystem && c.blockId === BLOCK_IDS.administrativeExpenses,
    )!
    const response = await patchEntry(
      new Request(`https://x/api/v1/entries/${created.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ kind: 'Expense', categoryId: outra.id }),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({ id: created.id }) },
    )
    expect(response.status).toBe(200)
    expect(await handle.repositories.discretionaryExpenseReader.listAll(TEST_USER_ID)).toEqual([])
    const entry = await getEntry(new Request(`https://x/api/v1/entries/${created.id}`), {
      params: Promise.resolve({ id: created.id }),
    })
    await expect(entry.json()).resolves.toMatchObject({ categoryId: outra.id, amount: 4_500 })
  })
})
