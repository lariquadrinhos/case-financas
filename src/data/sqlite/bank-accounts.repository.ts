/**
 * Contas Bancárias — the SQLite adapter for `src/data/contracts/bank-accounts.ts`.
 *
 * `balance` is kept BY THE PERSON, not derived from lançamentos (PRD §1), so the
 * writer stores exactly the integer of cents it is given — no aggregation query
 * lives here.
 */

import { randomUUID } from 'node:crypto'

import { and, eq, sql } from 'drizzle-orm'

import { isForeignKeyViolation } from './constraint-errors'
import { cents } from '@/domain/core'
import type { BankAccount, BankAccountColour } from '@/domain/assets'
import { asId, type BankAccountId, type Entity } from '@/domain/core'
import type {
  BankAccountReader,
  BankAccountWriter,
  NewBankAccount,
} from '@/data/contracts/bank-accounts'
import type { Page, UserId } from '@/data/contracts/common'
import type { BigornaDatabase } from './client'
import { bankAccounts } from './schema'

type BankAccountRow = typeof bankAccounts.$inferSelect

function toBankAccount(row: BankAccountRow): BankAccount {
  return {
    id: asId<BankAccountId>(row.id),
    label: row.label,
    /* A coluna é `text` (schema.ts), não um CHECK: a lista fechada de cores
       (`BANK_ACCOUNT_COLOURS`, Figma Tokens `1091:2`) é imposta na borda de
       escrita por `bankAccountColourSchema`. Linhas gravadas antes de a lista
       fechar carregam slug fora dela e continuam legíveis — `bankAccountSwatch`
       cai na "Cor extra" cinza em vez de uma bolinha invisível. */
    colour: row.colour as BankAccountColour,
    entity: row.entity,
    balance: cents(row.balance),
  }
}

export function createBankAccountRepository(db: BigornaDatabase): {
  reader: BankAccountReader
  writer: BankAccountWriter
} {
  const reader: BankAccountReader = {
    async findById(userId: UserId, id: BankAccountId) {
      const row = db
        .select()
        .from(bankAccounts)
        .where(and(eq(bankAccounts.userId, userId), eq(bankAccounts.id, id)))
        .get()
      return row ? toBankAccount(row) : null
    },

    async list(userId: UserId, page?: Page) {
      const query = db.select().from(bankAccounts).where(eq(bankAccounts.userId, userId))
      const rows =
        page === undefined ? query.all() : query.limit(page.limit).offset(page.offset).all()
      return rows.map(toBankAccount)
    },

    async count(userId: UserId) {
      const row = db
        .select({ total: sql<number>`count(*)` })
        .from(bankAccounts)
        .where(eq(bankAccounts.userId, userId))
        .get()
      return row?.total ?? 0
    },

    // Pró-labore e Distribuição filters the origin dropdown to PJ and the
    // destination to PF (PRD §1) — this is what feeds those two dropdowns.
    async listByEntity(userId: UserId, entity: Entity) {
      const rows = db
        .select()
        .from(bankAccounts)
        .where(and(eq(bankAccounts.userId, userId), eq(bankAccounts.entity, entity)))
        .all()
      return rows.map(toBankAccount)
    },
  }

  const writer: BankAccountWriter = {
    async create(userId: UserId, value: NewBankAccount) {
      const id = randomUUID()
      db.insert(bankAccounts)
        .values({ userId, id, ...value })
        .run()
      return { id: asId<BankAccountId>(id), ...value }
    },

    async replace(userId: UserId, value: BankAccount) {
      const result = db
        .update(bankAccounts)
        .set({
          label: value.label,
          colour: value.colour,
          entity: value.entity,
          balance: value.balance,
        })
        .where(and(eq(bankAccounts.userId, userId), eq(bankAccounts.id, value.id)))
        .run()
      // ADR-0008 §3: an id that is not this user's updates zero rows — the row
      // is treated as absent, never silently written to someone else's scope.
      if (result.changes === 0) {
        throw new Error('bank_accounts.not_found')
      }
      return value
    },

    async remove(userId: UserId, id: BankAccountId) {
      // The RESTRICT foreign keys on entries/recurrences/etc. make SQLite refuse
      // this delete while the account is still referenced. The API contract
      // (src/api/contracts/bank-accounts.ts) promises 409 for that case, not a
      // raw driver error, so the constraint violation is translated here, once.
      try {
        db.delete(bankAccounts)
          .where(and(eq(bankAccounts.userId, userId), eq(bankAccounts.id, id)))
          .run()
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          throw new Error('bank_accounts.in_use')
        }
        throw error
      }
    },
  }

  return { reader, writer }
}
