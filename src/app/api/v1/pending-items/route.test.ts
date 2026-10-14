/**
 * `GET /api/v1/pending-items` — H13, the join across the four bounded
 * contexts (docs/event-storming §"Bounded contexts", contexto 7).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { EMPTY_ALLOCATION_ITEMS } from '@/domain/profit-allocation'
import {
  UNCATEGORIZED_CATEGORIES,
  UNCATEGORIZED_EXPENSE_CATEGORY_ID,
} from '@/domain/chart-of-accounts'
import { cents, isoDate, month } from '@/domain/core'
import { getRepositories } from '@/data'
import { seedEntriesFixture, type EntriesTestFixture } from '@/data/fixtures/entries-test-fixtures'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { GET } from './route'

function jsonRequest(url: string): Request {
  return new Request(url)
}

describe('GET /api/v1/pending-items', () => {
  let handle: TestRepositories
  let fixture: EntriesTestFixture

  beforeEach(async () => {
    handle = useTestRepositories()
    fixture = await seedEntriesFixture(TEST_USER_ID)
  })

  afterEach(() => {
    handle.teardown()
  })

  it('is empty on a freshly created account (files_design/08 §9.1, 0 pendências)', async () => {
    const response = await GET(jsonRequest('https://x/api/v1/pending-items'))
    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: unknown[]; meta: { total: number } }
    expect(body).toEqual({ data: [], meta: { total: 0 } })
  })

  it('combines all four kinds, oldest first, dropping what is already resolved', async () => {
    const {
      tangibleAssetWriter,
      pendingAllocationWriter,
      recurrenceWriter,
      occurrenceWriter,
      profitAllocationWriter,
      entryWriter,
      paymentDiscrepancyWriter,
    } = getRepositories()

    // Tipo 1 — Pendente de Direcionamento (2026-07-01)
    const asset = await tangibleAssetWriter.create(TEST_USER_ID, {
      name: 'Carro antigo',
      entity: 'PF',
      recordedValue: cents(20_000_00),
    })
    await pendingAllocationWriter.create(TEST_USER_ID, {
      origin: { kind: 'TangibleAssetSale', tangibleAssetId: asset.id },
      amount: cents(5_000_00),
      originDate: isoDate('2026-07-01'),
      status: 'Pending',
    })

    // Tipo 2 — Ocorrência "a definir" sem valor (2026-07-05)
    const recurrence = await recurrenceWriter.create(TEST_USER_ID, {
      template: {
        kind: 'Expense',
        amount: cents(0),
        entity: 'PF',
        categoryId: fixture.expenseCategoryId,
        classification: 'Current',
        bankAccountId: fixture.pfAccountId,
      },
      amountKind: 'ToBeDefined',
      startDate: isoDate('2026-07-05'),
      endsOn: null,
    })
    await occurrenceWriter.create(TEST_USER_ID, {
      recurrenceId: recurrence.id,
      month: month('2026-07'),
      plannedDate: isoDate('2026-07-05'),
      plannedAmount: null,
      status: 'Planned',
      discarded: false,
      entryId: null,
    })

    // Tipo 3 — Saldo não alocado da Destinação do Lucro (2026-07-01, mês inteiro)
    await profitAllocationWriter.save(TEST_USER_ID, {
      month: month('2026-07'),
      netProfit: cents(9_000_00),
      items: EMPTY_ALLOCATION_ITEMS,
    })

    // Tipo 4 — Divergência de pagamento a menor (2026-07-15)
    const entry = await entryWriter.create(TEST_USER_ID, {
      kind: 'Expense',
      amount: cents(1_300_00),
      date: isoDate('2026-07-15'),
      status: 'Paid',
      recurrenceId: null,
      entity: 'PF',
      categoryId: fixture.expenseCategoryId,
      classification: 'Current',
      bankAccountId: fixture.pfAccountId,
    })
    await paymentDiscrepancyWriter.create(TEST_USER_ID, {
      origin: { kind: 'Entry', entryId: entry.id },
      shortfall: cents(200_00),
      originDate: isoDate('2026-07-15'),
      status: 'Pending',
    })
    // A resolved one must NOT show up.
    await paymentDiscrepancyWriter.create(TEST_USER_ID, {
      origin: { kind: 'Entry', entryId: entry.id },
      shortfall: cents(50_00),
      originDate: isoDate('2026-01-01'),
      status: 'Resolved',
    })

    const response = await GET(jsonRequest('https://x/api/v1/pending-items'))
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      data: { kind: string; date: string }[]
      meta: { total: number }
    }

    expect(body.meta.total).toBe(4)
    expect(body.data.map((item) => item.kind)).toEqual([
      'AssetSaleAllocation', // 2026-07-01
      'UnallocatedProfit', // 2026-07-01
      'UndefinedOccurrence', // 2026-07-05
      'PaymentDiscrepancy', // 2026-07-15
    ])
  })
  it('PRD v7.46 — lançamentos em "A categorizar" viram uma pendência por mês, com a contagem', async () => {
    const { categoryWriter, entryWriter } = getRepositories()
    await categoryWriter.seed(TEST_USER_ID, UNCATEGORIZED_CATEGORIES)
    for (const date of ['2026-09-03', '2026-09-20']) {
      await entryWriter.create(TEST_USER_ID, {
        kind: 'Expense',
        amount: cents(1000),
        date: isoDate(date),
        status: 'Paid',
        recurrenceId: null,
        entity: 'PF',
        categoryId: UNCATEGORIZED_EXPENSE_CATEGORY_ID,
        classification: 'Current',
        bankAccountId: fixture.pfAccountId,
      })
    }
    const response = await GET(jsonRequest('https://x/api/v1/pending-items'))
    const body = (await response.json()) as { data: { kind: string; item: unknown }[] }
    expect(body.data).toContainEqual({
      kind: 'Uncategorized',
      date: '2026-09-01',
      amount: null,
      item: { month: '2026-09', count: 2 },
    })
  })
})
