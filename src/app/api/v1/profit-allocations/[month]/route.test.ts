/**
 * `GET, PUT /api/v1/profit-allocations/{month}` — integration tests.
 *
 * `PUT` computes the Lucro Líquido via the DRE, which needs `EntryReader` —
 * not wired to a real SQLite adapter yet (`src/data/sqlite/index.ts`). This
 * file injects a small in-memory fake for that ONE port via `setRepositories`,
 * on top of the REAL sqlite adapters `useTestRepositories` already gives every
 * other port (profitAllocationReader/Writer included) — the same seam
 * `src/data/index.ts` documents for swapping an adapter without touching a
 * handler.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_BLOCKS, DEFAULT_CATEGORIES } from '@/domain/chart-of-accounts'
import type { Entry } from '@/domain/entries'
import { cents, isoDate, type Month } from '@/domain/core'
import { setRepositories, type Repositories } from '@/data'
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

function context(month: string) {
  return { params: Promise.resolve({ month }) }
}

/** A fake `EntryReader` returning a fixed set of entries for one month, ids unused. */
function fakeEntryReader(entriesByMonth: ReadonlyMap<Month, readonly Entry[]>) {
  return {
    async findById() {
      return null
    },
    async list() {
      return []
    },
    async count() {
      return 0
    },
    async search() {
      return { items: [], total: 0 }
    },
    async listByMonth(_userId: unknown, month: Month) {
      return entriesByMonth.get(month) ?? []
    },
    async listByRecurrence() {
      return []
    },
  }
}

describe('GET, PUT /api/v1/profit-allocations/{month}', () => {
  let handle: TestRepositories

  beforeEach(async () => {
    handle = useTestRepositories()
    await handle.repositories.statementBlockWriter.seed(TEST_USER_ID, DEFAULT_BLOCKS)
    await handle.repositories.categoryWriter.seed(TEST_USER_ID, DEFAULT_CATEGORIES)
  })

  afterEach(() => {
    handle.teardown()
  })

  function withNetProfit(month: Month, netProfitCents: number): void {
    // One Receita entry in the reference "Freelance/Renda extra" category is
    // enough to give the DRE a Lucro Líquido without wiring the whole cascade.
    const entry: Entry = {
      id: 'entry-1' as never,
      kind: 'Revenue',
      amount: cents(netProfitCents),
      date: isoDate(`${month}-10`),
      status: 'Paid',
      recurrenceId: null,
      entity: 'PF',
      categoryId: DEFAULT_CATEGORIES.find((c) => c.id === 'freelance-renda-extra')!.id,
      classification: 'Current',
      bankAccountId: 'account-1' as never,
    }
    const combined: Repositories = {
      ...handle.repositories,
      entryReader: fakeEntryReader(new Map([[month, [entry]]])),
    }
    setRepositories(combined, handle.connection, handle.db)
  }

  it('GET answers 404 before any allocation was saved for the month', async () => {
    const response = await GET(
      new Request('https://x/api/v1/profit-allocations/2026-07'),
      context('2026-07'),
    )
    expect(response.status).toBe(404)
  })

  it('PUT computes the Lucro Líquido from the DRE and saves the allocation', async () => {
    withNetProfit('2026-07' as Month, 100_000)
    const account = await handle.repositories.bankAccountWriter.create(TEST_USER_ID, {
      label: 'Nubank',
      colour: 'nubank',
      entity: 'PF',
      balance: cents(0),
    })

    const response = await PUT(
      jsonRequest('https://x/api/v1/profit-allocations/2026-07', 'PUT', {
        items: {
          CashReserve: [
            { destination: { kind: 'BankAccount', bankAccountId: account.id }, amount: 40_000 },
          ],
        },
      }),
      context('2026-07'),
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      netProfit: number
      unallocatedBalance: number
      items: { CashReserve: unknown[] }
    }
    expect(body.netProfit).toBe(100_000)
    expect(body.unallocatedBalance).toBe(60_000)
    expect(body.items.CashReserve).toHaveLength(1)

    const get = await GET(
      new Request('https://x/api/v1/profit-allocations/2026-07'),
      context('2026-07'),
    )
    expect(get.status).toBe(200)
  })

  it('PUT answers 409 when there is no profit to allocate', async () => {
    withNetProfit('2026-07' as Month, 0)
    const response = await PUT(
      jsonRequest('https://x/api/v1/profit-allocations/2026-07', 'PUT', { items: {} }),
      context('2026-07'),
    )
    expect(response.status).toBe(409)
  })

  it('PUT answers 422 when the items exceed the net profit', async () => {
    withNetProfit('2026-07' as Month, 10_000)
    const account = await handle.repositories.bankAccountWriter.create(TEST_USER_ID, {
      label: 'Nubank',
      colour: 'nubank',
      entity: 'PF',
      balance: cents(0),
    })

    const response = await PUT(
      jsonRequest('https://x/api/v1/profit-allocations/2026-07', 'PUT', {
        items: {
          CashReserve: [
            { destination: { kind: 'BankAccount', bankAccountId: account.id }, amount: 20_000 },
          ],
        },
      }),
      context('2026-07'),
    )
    expect(response.status).toBe(422)
  })

  /**
   * Regression: an item whose destino names a Conta/Investimento that does not
   * exist for this user used to reach `handler()` as a raw SQLite FOREIGN KEY
   * error and answer 500 — the client's fault reported as the server's. The
   * adapter now translates it to `profit_allocation.unknown_reference` (404),
   * the same rule `entries.unknown_reference` already follows.
   */
  it('PUT answers 404 when a destination names a conta that does not exist', async () => {
    withNetProfit('2026-07' as Month, 100_000)

    const response = await PUT(
      jsonRequest('https://x/api/v1/profit-allocations/2026-07', 'PUT', {
        items: {
          CashReserve: [
            {
              destination: { kind: 'BankAccount', bankAccountId: 'does-not-exist' },
              amount: 5_000,
            },
          ],
        },
      }),
      context('2026-07'),
    )

    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toBe('application/problem+json')
  })

  it('PUT answers 422 when a destination does not match its bucket', async () => {
    withNetProfit('2026-07' as Month, 10_000)
    const investment = await handle.repositories.investmentWriter.create(TEST_USER_ID, {
      name: 'Tesouro Direto',
      entity: 'PF',
      accumulatedValue: cents(0),
    })

    const response = await PUT(
      jsonRequest('https://x/api/v1/profit-allocations/2026-07', 'PUT', {
        items: {
          CashReserve: [
            { destination: { kind: 'Investment', investmentId: investment.id }, amount: 1_000 },
          ],
        },
      }),
      context('2026-07'),
    )
    expect(response.status).toBe(422)
  })
})
