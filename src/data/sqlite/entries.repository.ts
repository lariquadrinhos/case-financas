/**
 * Lançamento — the SQLite adapter for `EntryReader`/`EntryWriter`
 * (src/data/contracts/entries.ts).
 *
 * The `entries` table flattens the five-kind union into one row with nullable
 * columns per variant (schema.ts). This file is the ONLY place that undoes the
 * flattening: `toEntry` builds a clean per-kind object literal (so a pró-labore
 * round-trips with no `entity` key at all, not `entity: null`), and `toRow`
 * nulls out every column the given kind does not use, so a replace can never
 * leave a stale value from what the row used to be.
 */

import { randomUUID } from 'node:crypto'

import { and, asc, eq, isNull, like, or, sql } from 'drizzle-orm'

import {
  asId,
  cents,
  isoDate,
  month,
  type BankAccountId,
  type CategoryId,
  type EntryId,
  type Month,
  type RecurrenceId,
} from '@/domain/core'
import {
  accountingMonth,
  visibleInView,
  type Entry,
  type EntryFilter,
  type NewEntry,
} from '@/domain/entries'
import type { EntryReader, EntryWriter } from '@/data/contracts/entries'
import type { Page, PagedResult, UserId } from '@/data/contracts/common'
import type { BigornaDatabase } from './client'
import { isForeignKeyViolation } from './constraint-errors'
import { entries } from './schema'

type EntryRow = typeof entries.$inferSelect

/**
 * A write that names a Categoria/Conta/Recorrência that does not exist for this
 * user violates one of the RESTRICT foreign keys of `entries` (schema.ts). It is
 * the client naming an absent resource, not the store breaking, so it becomes
 * `entries.unknown_reference` → 404 (src/api/http.ts). Anything else is rethrown
 * untouched: an unexamined error must stay a 500.
 */
function translateReferenceViolation(error: unknown): unknown {
  return isForeignKeyViolation(error) ? new Error('entries.unknown_reference') : error
}

/* -------------------------------------------------------------------------
 * Row ↔ Entry
 * ---------------------------------------------------------------------- */

function toEntry(row: EntryRow): Entry {
  const base = {
    id: asId<EntryId>(row.id),
    amount: cents(row.amount),
    date: isoDate(row.date),
    status: row.status,
    recurrenceId: row.recurrenceId ? asId<RecurrenceId>(row.recurrenceId) : null,
    // Only when present: an entry without one reads exactly as it did before
    // the field existed.
    ...(row.description !== null ? { description: row.description } : {}),
  }

  switch (row.kind) {
    case 'Expense':
      return {
        ...base,
        kind: 'Expense',
        entity: row.entity!,
        categoryId: asId<CategoryId>(row.categoryId!),
        classification: row.classification!,
        bankAccountId: asId<BankAccountId>(row.bankAccountId!),
        // Same conditional spread as `description`: an entry without either
        // reads exactly as it did before the fields existed (ADR-0021).
        ...(row.isCreditCard ? { isCreditCard: true } : {}),
        ...(row.accountingMonth !== null ? { accountingMonth: month(row.accountingMonth) } : {}),
      }
    case 'Revenue':
      return {
        ...base,
        kind: 'Revenue',
        entity: row.entity!,
        categoryId: asId<CategoryId>(row.categoryId!),
        classification: row.classification!,
        bankAccountId: asId<BankAccountId>(row.bankAccountId!),
        ...(row.isCreditCard ? { isCreditCard: true } : {}),
      }
    case 'ProLabore':
      return {
        ...base,
        kind: 'ProLabore',
        sourceAccountId:
          row.sourceAccountId === null ? null : asId<BankAccountId>(row.sourceAccountId),
        destinationAccountId: asId<BankAccountId>(row.destinationAccountId!),
      }
    case 'ProfitDistribution':
      return {
        ...base,
        kind: 'ProfitDistribution',
        sourceAccountId:
          row.sourceAccountId === null ? null : asId<BankAccountId>(row.sourceAccountId),
        destinationAccountId: asId<BankAccountId>(row.destinationAccountId!),
      }
    case 'IncomeTax':
      return {
        ...base,
        kind: 'IncomeTax',
        direction: row.direction!,
        entity: row.entity!,
        bankAccountId: asId<BankAccountId>(row.bankAccountId!),
        label: row.label,
      }
  }
}

/**
 * The insertable/updatable column set for one entry, with every column the
 * kind does NOT use explicitly nulled — never left as "whatever was there
 * before", which is what a partial `.set()` would do on a replace that changes
 * kind-specific fields.
 */
function toColumns(entry: Entry | NewEntry) {
  const common = {
    kind: entry.kind,
    amount: entry.amount,
    date: entry.date,
    status: entry.status,
    recurrenceId: entry.recurrenceId,
    entity: null,
    categoryId: null,
    classification: null,
    bankAccountId: null,
    sourceAccountId: null,
    destinationAccountId: null,
    direction: null,
    label: null,
    description: entry.description?.trim() ? entry.description.trim() : null,
    isCreditCard: false,
    accountingMonth: null as string | null,
  }

  switch (entry.kind) {
    case 'Expense':
      return {
        ...common,
        entity: entry.entity,
        categoryId: entry.categoryId,
        classification: entry.classification,
        bankAccountId: entry.bankAccountId,
        isCreditCard: entry.isCreditCard ?? false,
        accountingMonth: entry.accountingMonth ?? null,
      }
    case 'Revenue':
      return {
        ...common,
        entity: entry.entity,
        categoryId: entry.categoryId,
        classification: entry.classification,
        bankAccountId: entry.bankAccountId,
        isCreditCard: entry.isCreditCard ?? false,
      }
    case 'ProLabore':
    case 'ProfitDistribution':
      return {
        ...common,
        sourceAccountId: entry.sourceAccountId,
        destinationAccountId: entry.destinationAccountId,
      }
    case 'IncomeTax':
      return {
        ...common,
        direction: entry.direction,
        entity: entry.entity,
        bankAccountId: entry.bankAccountId,
        label: entry.label,
      }
  }
}

/**
 * The SQL side of `accountingMonth` (src/domain/entries/rules.ts): the
 * "Contabilizar em" when there is one, else the month of the payment date
 * (ADR-0021).
 */
function inAccountingMonth(m: Month) {
  return or(
    eq(entries.accountingMonth, m),
    and(isNull(entries.accountingMonth), like(entries.date, `${m}-%`)),
  )!
}

/* -------------------------------------------------------------------------
 * Repository
 * ---------------------------------------------------------------------- */

export function createEntryRepository(db: BigornaDatabase): {
  reader: EntryReader
  writer: EntryWriter
} {
  function row(userId: UserId, id: EntryId): EntryRow | undefined {
    return db
      .select()
      .from(entries)
      .where(and(eq(entries.userId, userId), eq(entries.id, id)))
      .get()
  }

  const reader: EntryReader = {
    async findById(userId: UserId, id: EntryId) {
      const found = row(userId, id)
      return found ? toEntry(found) : null
    },

    async list(userId: UserId, page?: Page) {
      const query = db
        .select()
        .from(entries)
        .where(eq(entries.userId, userId))
        .orderBy(asc(entries.date), sql`rowid`)
      const rows =
        page === undefined ? query.all() : query.limit(page.limit).offset(page.offset).all()
      return rows.map(toEntry)
    },

    async count(userId: UserId) {
      const counted = db
        .select({ total: sql<number>`count(*)` })
        .from(entries)
        .where(eq(entries.userId, userId))
        .get()
      return counted?.total ?? 0
    },

    /**
     * Six of the seven Histórico filters (files_design/03) translate directly
     * into SQL columns. The seventh, `view`, does NOT: whether a pró-labore
     * shows up under "Consolidado" is the intercompany elimination rule
     * (`visibleInView`, src/domain/entries/projection.ts), and re-deriving it
     * here in SQL is exactly the drift H2 warns against — the Histórico must
     * never list a lançamento the DRE eliminates. So `view` is applied in
     * application code, over rows already narrowed by every other filter.
     */
    async search(userId: UserId, filter: EntryFilter, page?: Page): Promise<PagedResult<Entry>> {
      const conditions = [eq(entries.userId, userId)]
      if (filter.status !== null) conditions.push(eq(entries.status, filter.status))
      if (filter.month !== null) conditions.push(inAccountingMonth(filter.month))
      if (filter.categoryId !== null) conditions.push(eq(entries.categoryId, filter.categoryId))
      if (filter.classification !== null) {
        conditions.push(eq(entries.classification, filter.classification))
      }
      if (filter.bankAccountId !== null) {
        // files_design/03: an intercompany entry matches on EITHER of its two
        // accounts, not only the single `bankAccountId` column ordinary
        // entries use (rules.ts `filterEntries` applies the same widening).
        conditions.push(
          or(
            eq(entries.bankAccountId, filter.bankAccountId),
            eq(entries.sourceAccountId, filter.bankAccountId),
            eq(entries.destinationAccountId, filter.bankAccountId),
          )!,
        )
      }
      if (filter.recurring !== null) {
        conditions.push(
          filter.recurring
            ? sql`${entries.recurrenceId} IS NOT NULL`
            : sql`${entries.recurrenceId} IS NULL`,
        )
      }

      const matched = db
        .select()
        .from(entries)
        .where(and(...conditions))
        .orderBy(asc(entries.date), sql`rowid`)
        .all()
        .map(toEntry)

      const filtered =
        filter.view === null
          ? matched
          : matched.filter((entry) => visibleInView(entry, filter.view!))

      const items =
        page === undefined ? filtered : filtered.slice(page.offset, page.offset + page.limit)
      return { items, total: filtered.length }
    },

    async listByMonth(userId: UserId, month: Month) {
      return (
        db
          .select()
          .from(entries)
          .where(and(eq(entries.userId, userId), inAccountingMonth(month)))
          .orderBy(asc(entries.date), sql`rowid`)
          .all()
          .map(toEntry)
          // `like` matches the text prefix; a stray "2026-1-05" would also match
          // "2026-1%" for month "2026-1" if the CHECK ever let one in — the
          // application-side check, through the domain's one rule, is the belt
          // to the schema's suspenders.
          .filter((entry) => accountingMonth(entry) === month)
      )
    },

    async listByRecurrence(userId: UserId, recurrenceId: string) {
      return db
        .select()
        .from(entries)
        .where(and(eq(entries.userId, userId), eq(entries.recurrenceId, recurrenceId)))
        .orderBy(asc(entries.date), sql`rowid`)
        .all()
        .map(toEntry)
    },
  }

  const writer: EntryWriter = {
    async create(userId: UserId, value: NewEntry) {
      const id = randomUUID()
      try {
        db.insert(entries)
          .values({ userId, id, ...toColumns(value) })
          .run()
      } catch (error) {
        // The body named a Categoria, uma Conta Bancária or uma Recorrência
        // that does not exist for THIS user. The request is well-formed and
        // names something absent, so it is a 404, not a 500 — src/api/http.ts
        // states the rule ("404 — the request names something that does not
        // exist"). Left unclassified it surfaced as `internal.unexpected`,
        // telling the client the server broke when its own body was wrong.
        throw translateReferenceViolation(error)
      }
      return { id: asId<EntryId>(id), ...value } as Entry
    },

    async replace(userId: UserId, value: Entry) {
      let result
      try {
        result = db
          .update(entries)
          .set(toColumns(value))
          .where(and(eq(entries.userId, userId), eq(entries.id, value.id)))
          .run()
      } catch (error) {
        throw translateReferenceViolation(error)
      }
      // ADR-0008 §3: an id that is not this user's updates zero rows — treated
      // as absent, never silently written into someone else's scope.
      if (result.changes === 0) {
        throw new Error('entries.unknown_entry')
      }
      return value
    },

    async remove(userId: UserId, id: EntryId) {
      try {
        db.delete(entries)
          .where(and(eq(entries.userId, userId), eq(entries.id, id)))
          .run()
      } catch (error) {
        // An occurrence still points at this entry as the one it produced
        // when it was marked Pago (schema.ts `occurrences.entry_id`, RESTRICT).
        if (isForeignKeyViolation(error)) {
          throw new Error('entries.in_use')
        }
        throw error
      }
    },
  }

  return { reader, writer }
}
