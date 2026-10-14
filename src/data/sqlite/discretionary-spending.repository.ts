/**
 * Consumo Livre — the SQLite adapter for
 * `src/data/contracts/discretionary-spending.ts`.
 *
 * A "Gastei um valor" is stored across TWO tables (schema.ts): a real row in
 * `entries` (kind `Expense`, built by `buildExpenseEntry` with the fixed
 * category and the config's account/entity — files_design/03) plus one row in
 * `discretionary_expenses` carrying the one field the Aba Despesa does not
 * have, the Rótulo. Both writes happen in one transaction: a Consumo Livre
 * expense with an entry but no side row (or the reverse) is a state no screen
 * expects.
 *
 * This is the one adapter in the folder that writes into ANOTHER aggregate's
 * table (`entries`) directly rather than through `EntryWriter` — kept that way
 * so this file stays self-contained like every other adapter here (none of
 * them composes another repository), and because the shape it writes is fixed
 * by `buildExpenseEntry`, not something a caller varies.
 */

import { randomUUID } from 'node:crypto'

import { and, eq, like } from 'drizzle-orm'

import { buildExpenseEntry } from '@/domain/discretionary-spending'
import type {
  DiscretionaryExpense,
  DiscretionarySpendingConfig,
} from '@/domain/discretionary-spending'
import {
  asId,
  cents,
  isoDate,
  monthOf,
  type BankAccountId,
  type EntryId,
  type Month,
} from '@/domain/core'
import type {
  DiscretionaryExpenseReader,
  DiscretionaryExpenseWriter,
  DiscretionarySpendingConfigReader,
  DiscretionarySpendingConfigWriter,
} from '@/data/contracts/discretionary-spending'
import type { UserId } from '@/data/contracts/common'
import type { BigornaDatabase } from './client'
import { isForeignKeyViolation } from './constraint-errors'
import { discretionaryExpenses, discretionarySpendingConfig, entries } from './schema'

/**
 * A `sourceAccountId` that names no Conta Bancária of THIS user, or a chart of
 * accounts without the fixed "Consumo Livre" category, trips a composite
 * foreign key of `schema.ts`. That is the caller naming something absent, not a
 * broken store, so it becomes `discretionary_spending.unknown_reference` → 404
 * (src/api/http.ts) instead of surfacing as an unclassified 500 — the same
 * translation `entries.repository.ts` already does for `entries.unknown_reference`.
 */
function translateReference(error: unknown): unknown {
  return isForeignKeyViolation(error)
    ? new Error('discretionary_spending.unknown_reference')
    : error
}

type ConfigRow = typeof discretionarySpendingConfig.$inferSelect
type ExpenseJoinRow = { entryId: string; date: string; amount: number; label: string | null }

function toConfig(row: ConfigRow): DiscretionarySpendingConfig {
  return {
    monthlyAmount: cents(row.monthlyAmount),
    sourceAccountId: asId<BankAccountId>(row.sourceAccountId),
    entity: row.entity,
    allowanceKind: row.allowanceKind,
  }
}

function toExpense(row: ExpenseJoinRow): DiscretionaryExpense {
  return {
    id: asId<EntryId>(row.entryId),
    date: isoDate(row.date),
    amount: cents(row.amount),
    label: row.label,
  }
}

export function createDiscretionarySpendingConfigRepository(db: BigornaDatabase): {
  reader: DiscretionarySpendingConfigReader
  writer: DiscretionarySpendingConfigWriter
} {
  const reader: DiscretionarySpendingConfigReader = {
    async find(userId: UserId) {
      const row = db
        .select()
        .from(discretionarySpendingConfig)
        .where(eq(discretionarySpendingConfig.userId, userId))
        .get()
      return row ? toConfig(row) : null
    },
  }

  const writer: DiscretionarySpendingConfigWriter = {
    // Singleton per person (schema.ts: the primary key is `user_id` alone) —
    // "Editar valor e conta" reopens the same two fields, so this is always an
    // upsert, never a create-then-replace pair (files_design/01 §4a).
    async save(userId: UserId, config: DiscretionarySpendingConfig) {
      try {
        db.insert(discretionarySpendingConfig)
          .values({
            userId,
            monthlyAmount: config.monthlyAmount,
            sourceAccountId: config.sourceAccountId,
            entity: config.entity,
            allowanceKind: config.allowanceKind ?? 'Fixed',
          })
          .onConflictDoUpdate({
            target: [discretionarySpendingConfig.userId],
            set: {
              monthlyAmount: config.monthlyAmount,
              sourceAccountId: config.sourceAccountId,
              entity: config.entity,
              allowanceKind: config.allowanceKind ?? 'Fixed',
            },
          })
          .run()
      } catch (error) {
        throw translateReference(error)
      }
      return config
    },
  }

  return { reader, writer }
}

export function createDiscretionaryExpenseRepository(db: BigornaDatabase): {
  reader: DiscretionaryExpenseReader
  writer: DiscretionaryExpenseWriter
} {
  function joinRow(userId: UserId, id: EntryId): ExpenseJoinRow | undefined {
    return db
      .select({
        entryId: entries.id,
        date: entries.date,
        amount: entries.amount,
        label: discretionaryExpenses.label,
      })
      .from(discretionaryExpenses)
      .innerJoin(
        entries,
        and(
          eq(entries.userId, discretionaryExpenses.userId),
          eq(entries.id, discretionaryExpenses.entryId),
        ),
      )
      .where(and(eq(discretionaryExpenses.userId, userId), eq(discretionaryExpenses.entryId, id)))
      .get()
  }

  const reader: DiscretionaryExpenseReader = {
    async findById(userId: UserId, id: EntryId) {
      const row = joinRow(userId, id)
      return row ? toExpense(row) : null
    },

    // The widget's history is a month at a time — the allowance refills on the
    // 1st (data/contracts/discretionary-spending.ts).
    async listByMonth(userId: UserId, month: Month) {
      const rows = db
        .select({
          entryId: entries.id,
          date: entries.date,
          amount: entries.amount,
          label: discretionaryExpenses.label,
        })
        .from(discretionaryExpenses)
        .innerJoin(
          entries,
          and(
            eq(entries.userId, discretionaryExpenses.userId),
            eq(entries.id, discretionaryExpenses.entryId),
          ),
        )
        .where(and(eq(discretionaryExpenses.userId, userId), like(entries.date, `${month}-%`)))
        .orderBy(entries.date)
        .all()
      // `like` matches the text prefix; the application-side equality is the
      // belt to the schema's suspenders, same reasoning as entries.repository.ts.
      return rows.map(toExpense).filter((expense) => monthOf(expense.date) === month)
    },

    // Todos os meses de uma vez — só a Pendência de sobra (P14) precisa disso,
    // e pelo mesmo motivo que `profitAllocationReader.listAll`: não há outra
    // forma de saber QUAIS meses já fecharam com sobra sem destino.
    async listAll(userId: UserId) {
      return db
        .select({
          entryId: entries.id,
          date: entries.date,
          amount: entries.amount,
          label: discretionaryExpenses.label,
        })
        .from(discretionaryExpenses)
        .innerJoin(
          entries,
          and(
            eq(entries.userId, discretionaryExpenses.userId),
            eq(entries.id, discretionaryExpenses.entryId),
          ),
        )
        .where(eq(discretionaryExpenses.userId, userId))
        .orderBy(entries.date)
        .all()
        .map(toExpense)
    },
  }

  const writer: DiscretionaryExpenseWriter = {
    // Assembles the Lançamento itself: the popover asks for the amount only,
    // so the account, the category and the entity come from the CONFIG, never
    // from the caller (files_design/03 "Consumo Livre — widget").
    async create(
      userId: UserId,
      expense: Omit<DiscretionaryExpense, 'id'> & { readonly description?: string | null },
    ) {
      const configRow = db
        .select()
        .from(discretionarySpendingConfig)
        .where(eq(discretionarySpendingConfig.userId, userId))
        .get()
      if (configRow === undefined) {
        throw new Error('discretionary_spending.not_configured')
      }
      const config = toConfig(configRow)
      const newEntry = buildExpenseEntry(config, expense.amount, expense.date)

      const entryId = randomUUID()
      try {
        db.transaction((tx) => {
          tx.insert(entries)
            .values({
              userId,
              id: entryId,
              kind: newEntry.kind,
              amount: newEntry.amount,
              date: newEntry.date,
              status: newEntry.status,
              recurrenceId: null,
              entity: newEntry.entity,
              categoryId: newEntry.categoryId,
              classification: newEntry.classification,
              bankAccountId: newEntry.bankAccountId,
              description: expense.description ?? null,
            })
            .run()
          tx.insert(discretionaryExpenses).values({ userId, entryId, label: expense.label }).run()
        })
      } catch (error) {
        throw translateReference(error)
      }

      return {
        id: asId<EntryId>(entryId),
        date: expense.date,
        amount: expense.amount,
        label: expense.label,
      }
    },

    // "Campos editáveis: Valor, e opcionalmente Rótulo" (files_design/03) —
    // category, account, entity and date are never touched from here.
    async replace(userId: UserId, expense: DiscretionaryExpense) {
      const existing = joinRow(userId, expense.id)
      if (existing === undefined) {
        throw new Error('discretionary_spending.expense_not_found')
      }
      db.transaction((tx) => {
        tx.update(entries)
          .set({ amount: expense.amount })
          .where(and(eq(entries.userId, userId), eq(entries.id, expense.id)))
          .run()
        tx.update(discretionaryExpenses)
          .set({ label: expense.label })
          .where(
            and(
              eq(discretionaryExpenses.userId, userId),
              eq(discretionaryExpenses.entryId, expense.id),
            ),
          )
          .run()
      })
      return expense
    },

    // A single statement, no `db.transaction`: it runs inside the PATCH's
    // `withTransaction` (src/data/index.ts), and SQLite does not nest BEGIN.
    async detach(userId: UserId, id: EntryId) {
      db.delete(discretionaryExpenses)
        .where(and(eq(discretionaryExpenses.userId, userId), eq(discretionaryExpenses.entryId, id)))
        .run()
    },

    async remove(userId: UserId, id: EntryId) {
      db.transaction((tx) => {
        // The side row first: `discretionary_expenses.entry_id` RESTRICTs
        // against `entries` (schema.ts), so the entry can only go once nothing
        // still points at it.
        tx.delete(discretionaryExpenses)
          .where(
            and(eq(discretionaryExpenses.userId, userId), eq(discretionaryExpenses.entryId, id)),
          )
          .run()
        tx.delete(entries)
          .where(and(eq(entries.userId, userId), eq(entries.id, id)))
          .run()
      })
    },
  }

  return { reader, writer }
}
