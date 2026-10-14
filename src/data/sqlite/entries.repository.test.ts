/**
 * Lançamento — SQLite adapter tests.
 *
 * `EntryReader`/`EntryWriter` are structurally a plain `Reader`/`Writer`
 * (src/data/contracts/entries.ts), and every entry — even two despesas with
 * the identical amount and date — is its own transaction with its own
 * store-assigned id, so `describeCrudContract` applies unmodified (SOLID/LSP).
 * `describeEntryContract` on top of it covers what is SPECIFIC to a
 * Lançamento: the payment-date month, the seven Histórico filters and the
 * shape of each of the five kinds.
 */

import { describeCrudContract } from '@/data/contracts/crud.contract-test'
import { describeEntryContract } from '@/data/contracts/entries.contract-test'
import {
  asId,
  cents,
  isoDate,
  type BankAccountId,
  type CategoryId,
  type EntryId,
} from '@/domain/core'
import type { NewEntry } from '@/domain/entries'
import type { UserId } from '@/data/contracts/common'
import { createEntryRepository } from './entries.repository'
import { createInMemoryDatabase, type BigornaDatabase } from './client'
import { bankAccounts, categories, statementBlocks } from './schema'

const CATEGORY_ID = 'aluguel-moradia' as CategoryId
const PF_ACCOUNT_ID = 'conta-pf' as BankAccountId
const PJ_ACCOUNT_ID = 'conta-pj' as BankAccountId

/** Everything a Lançamento can point at, for one user (ADR-0008 §3: composite FKs). */
function seedRefs(db: BigornaDatabase, userId: UserId): void {
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
    .run()
  db.insert(categories)
    .values({ userId, id: CATEGORY_ID, blockId: 'despesas-pessoais', name: 'Aluguel moradia' })
    .run()
  db.insert(bankAccounts)
    .values([
      {
        userId,
        id: PF_ACCOUNT_ID,
        label: 'Conta PF',
        colour: 'banco-do-brasil',
        entity: 'PF',
        balance: 0,
      },
      { userId, id: PJ_ACCOUNT_ID, label: 'Conta PJ', colour: 'itau', entity: 'PJ', balance: 0 },
    ])
    .run()
}

describeCrudContract({
  adapter: 'sqlite',
  aggregate: 'Entry',
  async create() {
    const { db, connection } = createInMemoryDatabase()
    const repo = createEntryRepository(db)
    return {
      reader: repo.reader,
      writer: repo.writer,
      async prepare(userId) {
        connection
          .prepare('insert into users (id, created_at) values (?, ?)')
          .run(userId, '2026-01-01')
        seedRefs(db, userId)
      },
      teardown: () => {
        connection.close()
      },
    }
  },
  sample(seed: number): NewEntry {
    return {
      kind: 'Expense',
      amount: cents(1_000 + seed),
      date: isoDate('2026-07-10'),
      status: 'Paid',
      recurrenceId: null,
      entity: 'PF',
      categoryId: CATEGORY_ID,
      classification: 'Current',
      bankAccountId: PF_ACCOUNT_ID,
    }
  },
  mutate(stored) {
    return { ...stored, amount: cents(stored.amount + 500) }
  },
  idOf: (stored) => stored.id,
  missingId: () => asId<EntryId>('does-not-exist'),
})

describeEntryContract({
  adapter: 'sqlite',
  async create() {
    const { db, connection } = createInMemoryDatabase()
    const repo = createEntryRepository(db)
    return {
      reader: repo.reader,
      writer: repo.writer,
      async prepare(userId) {
        connection
          .prepare('insert into users (id, created_at) values (?, ?)')
          .run(userId, '2026-01-01')
        seedRefs(db, userId)
        return { categoryId: CATEGORY_ID, pfAccountId: PF_ACCOUNT_ID, pjAccountId: PJ_ACCOUNT_ID }
      },
      teardown: () => {
        connection.close()
      },
    }
  },
})
