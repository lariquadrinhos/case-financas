/**
 * Destinar o Lucro — SQLite adapter tests.
 *
 * Keyed by MONTH, not by an id (data/contracts/profit-allocations.ts), so
 * `describeCrudContract` does not apply — this is a bespoke suite, same
 * reasoning as `chart-of-accounts.repository.test.ts`.
 */

import type BetterSqlite3 from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { EMPTY_ALLOCATION_ITEMS } from '@/domain/profit-allocation'
import type { ProfitAllocation } from '@/domain/profit-allocation'
import { cents, month } from '@/domain/core'
import { asId, type BankAccountId, type InvestmentId } from '@/domain/core'
import type { UserId } from '@/data/contracts/common'
import { createProfitAllocationRepository } from './profit-allocations.repository'
import { createInMemoryDatabase, type BigornaDatabase } from './client'

const USER_A = 'user-a' as UserId
const USER_B = 'user-b' as UserId
const MONTH_JULY = month('2026-07')
const MONTH_AUGUST = month('2026-08')
const INVESTMENT = asId<InvestmentId>('tesouro-direto')
const ACCOUNT = asId<BankAccountId>('conta-nubank-pf')

function seedUser(connection: BetterSqlite3.Database, id: UserId): void {
  connection.prepare('insert into users (id, created_at) values (?, ?)').run(id, '2026-01-01')
}

function seedInvestment(
  connection: BetterSqlite3.Database,
  userId: UserId,
  id: InvestmentId,
): void {
  connection
    .prepare(
      `insert into investments (user_id, id, name, entity, accumulated_value)
       values (?, ?, 'Tesouro Direto', 'PF', 500000)`,
    )
    .run(userId, id)
}

function seedAccount(connection: BetterSqlite3.Database, userId: UserId, id: BankAccountId): void {
  connection
    .prepare(
      `insert into bank_accounts (user_id, id, label, colour, entity, balance)
       values (?, ?, 'Nubank', 'nubank', 'PF', 100000)`,
    )
    .run(userId, id)
}

let db: BigornaDatabase
let connection: BetterSqlite3.Database

beforeEach(() => {
  const opened = createInMemoryDatabase()
  db = opened.db
  connection = opened.connection
  seedUser(connection, USER_A)
  seedUser(connection, USER_B)
  seedInvestment(connection, USER_A, INVESTMENT)
  seedAccount(connection, USER_A, ACCOUNT)
})

afterEach(() => {
  connection.close()
})

function allocation(month_: typeof MONTH_JULY, netProfit = cents(100_000)): ProfitAllocation {
  return {
    month: month_,
    netProfit,
    items: {
      ...EMPTY_ALLOCATION_ITEMS,
      InvestmentContribution: [
        { destination: { kind: 'Investment', investmentId: INVESTMENT }, amount: cents(30_000) },
      ],
      CashReserve: [
        { destination: { kind: 'BankAccount', bankAccountId: ACCOUNT }, amount: cents(10_000) },
        // An incomplete item (no destination) is allowed — it is what creates the Pendência.
        { destination: null, amount: cents(5_000) },
      ],
      ExtraordinaryConsumption: [
        { destination: { kind: 'FreeText', name: 'Viagem' }, amount: cents(2_000) },
      ],
    },
  }
}

describe('ProfitAllocation repository — sqlite', () => {
  it('findByMonth answers null before anything was saved', async () => {
    const { reader } = createProfitAllocationRepository(db)
    expect(await reader.findByMonth(USER_A, MONTH_JULY)).toBeNull()
  })

  it('save persists the header and every item, and reads back byte for byte', async () => {
    const { reader, writer } = createProfitAllocationRepository(db)
    const saved = await writer.save(USER_A, allocation(MONTH_JULY))

    expect(saved).toEqual(allocation(MONTH_JULY))
    expect(await reader.findByMonth(USER_A, MONTH_JULY)).toEqual(allocation(MONTH_JULY))
  })

  it('an untouched bucket reads back as an empty list, not missing', async () => {
    const { reader, writer } = createProfitAllocationRepository(db)
    await writer.save(USER_A, allocation(MONTH_JULY))

    const stored = await reader.findByMonth(USER_A, MONTH_JULY)
    expect(stored!.items.DividendReinvestment).toEqual([])
  })

  it('saving again REPLACES the item list wholesale — a removed item does not survive as an orphan', async () => {
    const { reader, writer } = createProfitAllocationRepository(db)
    await writer.save(USER_A, allocation(MONTH_JULY))

    const fewerItems: ProfitAllocation = {
      month: MONTH_JULY,
      netProfit: cents(100_000),
      items: {
        ...EMPTY_ALLOCATION_ITEMS,
        CashReserve: [
          { destination: { kind: 'BankAccount', bankAccountId: ACCOUNT }, amount: cents(1_000) },
        ],
      },
    }
    await writer.save(USER_A, fewerItems)

    const stored = await reader.findByMonth(USER_A, MONTH_JULY)
    expect(stored!.items.InvestmentContribution).toEqual([])
    expect(stored!.items.ExtraordinaryConsumption).toEqual([])
    expect(stored!.items.CashReserve).toEqual(fewerItems.items.CashReserve)
  })

  it('saving is idempotent on the header — re-saving the same month does not duplicate it', async () => {
    const { reader, writer } = createProfitAllocationRepository(db)
    await writer.save(USER_A, allocation(MONTH_JULY, cents(50_000)))
    await writer.save(USER_A, allocation(MONTH_JULY, cents(70_000)))

    const stored = await reader.findByMonth(USER_A, MONTH_JULY)
    expect(stored!.netProfit).toBe(70_000)
  })

  it('listByMonths reads several months at once, each with its own items', async () => {
    const { reader, writer } = createProfitAllocationRepository(db)
    await writer.save(USER_A, allocation(MONTH_JULY, cents(10_000)))
    await writer.save(USER_A, allocation(MONTH_AUGUST, cents(20_000)))

    const listed = await reader.listByMonths(USER_A, [MONTH_JULY, MONTH_AUGUST])
    expect(listed).toHaveLength(2)
    expect(listed.find((a) => a.month === MONTH_JULY)!.netProfit).toBe(10_000)
    expect(listed.find((a) => a.month === MONTH_AUGUST)!.netProfit).toBe(20_000)
  })

  it('listByMonths answers an empty list for an empty request, without querying', async () => {
    const { reader } = createProfitAllocationRepository(db)
    expect(await reader.listByMonths(USER_A, [])).toEqual([])
  })

  it('listAll returns every saved month, oldest first (H13 — Pendência unificada)', async () => {
    const { writer, reader } = createProfitAllocationRepository(db)
    await writer.save(USER_A, allocation(MONTH_AUGUST, cents(20_000)))
    await writer.save(USER_A, allocation(MONTH_JULY, cents(10_000)))

    const all = await reader.listAll(USER_A)
    expect(all.map((a) => a.month)).toEqual([MONTH_JULY, MONTH_AUGUST])
  })

  it('listAll is empty before anything was saved', async () => {
    const { reader } = createProfitAllocationRepository(db)
    expect(await reader.listAll(USER_A)).toEqual([])
  })

  it('ADR-0008 §3 — never returns another user’s allocation', async () => {
    const { reader, writer } = createProfitAllocationRepository(db)
    await writer.save(USER_A, allocation(MONTH_JULY))

    expect(await reader.findByMonth(USER_B, MONTH_JULY)).toBeNull()
    expect(await reader.listByMonths(USER_B, [MONTH_JULY])).toEqual([])
    expect(await reader.listAll(USER_B)).toEqual([])
  })
})
