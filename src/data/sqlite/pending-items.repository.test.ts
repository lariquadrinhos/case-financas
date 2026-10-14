/**
 * Divergência de pagamento a menor — SQLite adapter tests.
 *
 * `describeCrudContract` covers the shape every `Reader`/`Writer` must satisfy.
 * This file adds only what is specific to a payment discrepancy:
 * `listByStatus`, oldest-first — same contract as `pending-allocations`.
 */

import type BetterSqlite3 from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { describeCrudContract } from '@/data/contracts/crud.contract-test'
import type { PaymentDiscrepancyPendingItem } from '@/domain/pending-items'
import { cents, isoDate } from '@/domain/core'
import { asId, type EntryId, type PaymentDiscrepancyId } from '@/domain/core'
import type { UserId } from '@/data/contracts/common'
import type { NewPaymentDiscrepancy } from '@/data/contracts/pending-items'
import { createPaymentDiscrepancyRepository } from './pending-items.repository'
import { createInMemoryDatabase, type BigornaDatabase } from './client'
import { bankAccounts, categories, entries, statementBlocks } from './schema'

const USER_A = 'user-a' as UserId
const ENTRY_A = asId<EntryId>('lancamento-a')
const ENTRY_B = asId<EntryId>('lancamento-b')

function seedUser(connection: BetterSqlite3.Database, id: UserId): void {
  connection.prepare('insert into users (id, created_at) values (?, ?)').run(id, '2026-01-01')
}

/** Everything a Lançamento needs to exist, so it can be a valid FK target here. */
function seedEntry(db: BigornaDatabase, userId: UserId, id: EntryId): void {
  db.insert(statementBlocks)
    .values({
      userId,
      id: 'despesas-pessoais',
      name: 'Despesas Pessoais/Consumo',
      order: 5,
      effect: 'Subtract',
      belowTheLine: false,
      acceptsUserCategories: true,
      statementLabel: null,
    })
    .onConflictDoNothing()
    .run()
  db.insert(categories)
    .values({
      userId,
      id: 'aluguel-moradia',
      blockId: 'despesas-pessoais',
      name: 'Aluguel moradia',
    })
    .onConflictDoNothing()
    .run()
  db.insert(bankAccounts)
    .values({
      userId,
      id: 'conta-pf',
      label: 'Conta PF',
      colour: 'banco-do-brasil',
      entity: 'PF',
      balance: 0,
    })
    .onConflictDoNothing()
    .run()
  db.insert(entries)
    .values({
      userId,
      id,
      kind: 'Expense',
      amount: 10_000,
      date: '2026-07-10',
      status: 'Paid',
      entity: 'PF',
      categoryId: 'aluguel-moradia',
      classification: 'Current',
      bankAccountId: 'conta-pf',
    })
    .run()
}

describeCrudContract<PaymentDiscrepancyPendingItem, NewPaymentDiscrepancy, PaymentDiscrepancyId>({
  adapter: 'sqlite',
  aggregate: 'PaymentDiscrepancy',
  async create() {
    const { db, connection } = createInMemoryDatabase()
    return {
      reader: createPaymentDiscrepancyRepository(db).reader,
      writer: createPaymentDiscrepancyRepository(db).writer,
      async prepare(userId) {
        seedUser(connection, userId)
        seedEntry(db, userId, ENTRY_A)
      },
      teardown() {
        connection.close()
      },
    }
  },
  sample: (seed) => ({
    origin: { kind: 'Entry', entryId: ENTRY_A },
    shortfall: cents(seed * 1_000),
    originDate: isoDate('2026-07-10'),
    status: 'Pending',
  }),
  mutate: (stored) => ({ ...stored, status: 'Resolved' }),
  idOf: (stored) => stored.id,
  missingId: () => asId<PaymentDiscrepancyId>('does-not-exist'),
})

describe('PaymentDiscrepancy repository — sqlite specifics', () => {
  let db: BigornaDatabase
  let connection: BetterSqlite3.Database

  beforeEach(() => {
    const opened = createInMemoryDatabase()
    db = opened.db
    connection = opened.connection
    seedUser(connection, USER_A)
    seedEntry(db, USER_A, ENTRY_A)
    seedEntry(db, USER_A, ENTRY_B)
  })

  afterEach(() => {
    connection.close()
  })

  it('listByStatus returns only the matching status, oldest origin date first (PRD §1)', async () => {
    const { writer, reader } = createPaymentDiscrepancyRepository(db)
    const newer = await writer.create(USER_A, {
      origin: { kind: 'Entry', entryId: ENTRY_B },
      shortfall: cents(5_000),
      originDate: isoDate('2026-07-20'),
      status: 'Pending',
    })
    const older = await writer.create(USER_A, {
      origin: { kind: 'Entry', entryId: ENTRY_A },
      shortfall: cents(2_000),
      originDate: isoDate('2026-07-01'),
      status: 'Pending',
    })
    const resolved = await writer.create(USER_A, {
      origin: { kind: 'Entry', entryId: ENTRY_A },
      shortfall: cents(1_000),
      originDate: isoDate('2026-06-01'),
      status: 'Resolved',
    })

    const pending = await reader.listByStatus(USER_A, 'Pending')
    expect(pending).toEqual([older, newer])

    const resolvedList = await reader.listByStatus(USER_A, 'Resolved')
    expect(resolvedList).toEqual([resolved])
  })

  it('ADR-0008 §3 — listByStatus never returns another user’s rows', async () => {
    const { writer, reader } = createPaymentDiscrepancyRepository(db)
    await writer.create(USER_A, {
      origin: { kind: 'Entry', entryId: ENTRY_A },
      shortfall: cents(1_000),
      originDate: isoDate('2026-07-01'),
      status: 'Pending',
    })

    const otherUser = 'user-b' as UserId
    seedUser(connection, otherUser)
    expect(await reader.listByStatus(otherUser, 'Pending')).toEqual([])
  })
})
