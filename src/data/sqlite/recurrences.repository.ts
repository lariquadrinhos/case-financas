/**
 * Recorrência e Ocorrência — the SQLite adapters for
 * `src/data/contracts/recurrences.ts`.
 *
 * Two aggregates with two different id policies, and this file is where that
 * split becomes concrete:
 *
 *   - `RecurrenceWriter.create` assigns a RANDOM id, exactly like every other
 *     aggregate in this codebase: two identical templates started on the same
 *     day are still two separate séries, and a repeated `create` must not
 *     collide them.
 *   - `OccurrenceWriter.create` assigns a DERIVED id — `occurrenceIdFor(series,
 *     month)` (src/domain/recurrence/engine.ts) — because a série produces AT
 *     MOST ONE occurrence per month by construction. `create` is therefore an
 *     idempotent get-or-create: the Revisão de Recorrentes screen "materialises"
 *     the month's occurrences on every visit (ADR-0004, "materialização de
 *     ocorrências"), and re-materialising a month that already has a Paga or an
 *     edited occurrence must return that row untouched, never overwrite it back
 *     to a fresh Previsto — `onConflictDoNothing` is what makes that true.
 */

import { randomUUID } from 'node:crypto'

import { and, asc, eq, sql } from 'drizzle-orm'

import {
  asId,
  cents,
  isoDate,
  type BankAccountId,
  type CategoryId,
  type EntryId,
  type Month,
  type OccurrenceId,
  type RecurrenceId,
} from '@/domain/core'
import { occurrenceIdFor } from '@/domain/recurrence'
import type { Occurrence, Recurrence, RecurrenceTemplate } from '@/domain/recurrence'
import type {
  NewOccurrence,
  NewRecurrence,
  OccurrenceReader,
  OccurrenceWriter,
  RecurrenceReader,
  RecurrenceWriter,
} from '@/data/contracts/recurrences'
import type { Page, UserId } from '@/data/contracts/common'
import type { BigornaDatabase } from './client'
import { isForeignKeyViolation } from './constraint-errors'
import { occurrences, recurrences } from './schema'

type RecurrenceRow = typeof recurrences.$inferSelect
type OccurrenceRow = typeof occurrences.$inferSelect

/**
 * Same rule as `entries.repository.ts`: a template naming a Categoria or uma
 * Conta Bancária that does not exist for this user trips a RESTRICT foreign key
 * (schema.ts). That is the client naming an absent resource — 404 — and not the
 * store breaking, which is what an unclassified error would report as a 500.
 */
function translateReferenceViolation(error: unknown): unknown {
  return isForeignKeyViolation(error) ? new Error('recurrence.unknown_reference') : error
}

/* -------------------------------------------------------------------------
 * Row ↔ RecurrenceTemplate (mirrors entries.repository.ts `toEntry`/`toColumns`
 * one-for-one: `RecurrenceTemplate` IS an `Entry` minus the per-month fields)
 * ---------------------------------------------------------------------- */

function toTemplate(row: RecurrenceRow): RecurrenceTemplate {
  const template = toTemplateFields(row)
  // Same conditional spread as entries.repository.ts `toEntry`.
  return row.templateDescription !== null
    ? { ...template, description: row.templateDescription }
    : template
}

function toTemplateFields(row: RecurrenceRow): RecurrenceTemplate {
  const amount = cents(row.templateAmount as number)

  switch (row.templateKind) {
    case 'Expense':
      return {
        kind: 'Expense',
        amount,
        entity: row.templateEntity!,
        categoryId: asId<CategoryId>(row.templateCategoryId!),
        classification: row.templateClassification!,
        bankAccountId: asId<BankAccountId>(row.templateBankAccountId!),
        ...(row.templateIsCreditCard ? { isCreditCard: true } : {}),
      }
    case 'Revenue':
      return {
        kind: 'Revenue',
        amount,
        entity: row.templateEntity!,
        categoryId: asId<CategoryId>(row.templateCategoryId!),
        classification: row.templateClassification!,
        bankAccountId: asId<BankAccountId>(row.templateBankAccountId!),
        ...(row.templateIsCreditCard ? { isCreditCard: true } : {}),
      }
    case 'ProLabore':
      return {
        kind: 'ProLabore',
        amount,
        sourceAccountId:
          row.templateSourceAccountId === null
            ? null
            : asId<BankAccountId>(row.templateSourceAccountId),
        destinationAccountId: asId<BankAccountId>(row.templateDestinationAccountId!),
      }
    case 'ProfitDistribution':
      return {
        kind: 'ProfitDistribution',
        amount,
        sourceAccountId:
          row.templateSourceAccountId === null
            ? null
            : asId<BankAccountId>(row.templateSourceAccountId),
        destinationAccountId: asId<BankAccountId>(row.templateDestinationAccountId!),
      }
    case 'IncomeTax':
      return {
        kind: 'IncomeTax',
        amount,
        direction: row.templateDirection!,
        entity: row.templateEntity!,
        bankAccountId: asId<BankAccountId>(row.templateBankAccountId!),
        label: row.templateLabel,
      }
  }
}

function templateColumns(template: RecurrenceTemplate) {
  const common = {
    templateKind: template.kind,
    templateAmount: template.amount,
    templateEntity: null,
    templateCategoryId: null,
    templateClassification: null,
    templateBankAccountId: null,
    templateSourceAccountId: null,
    templateDestinationAccountId: null,
    templateDirection: null,
    templateLabel: null,
    templateDescription: template.description?.trim() ? template.description.trim() : null,
    templateIsCreditCard: false,
  }

  switch (template.kind) {
    case 'Expense':
      return {
        ...common,
        templateEntity: template.entity,
        templateCategoryId: template.categoryId,
        templateClassification: template.classification,
        templateBankAccountId: template.bankAccountId,
        templateIsCreditCard: template.isCreditCard ?? false,
      }
    case 'Revenue':
      return {
        ...common,
        templateEntity: template.entity,
        templateCategoryId: template.categoryId,
        templateClassification: template.classification,
        templateBankAccountId: template.bankAccountId,
        templateIsCreditCard: template.isCreditCard ?? false,
      }
    case 'ProLabore':
    case 'ProfitDistribution':
      return {
        ...common,
        templateSourceAccountId: template.sourceAccountId,
        templateDestinationAccountId: template.destinationAccountId,
      }
    case 'IncomeTax':
      return {
        ...common,
        templateDirection: template.direction,
        templateEntity: template.entity,
        templateBankAccountId: template.bankAccountId,
        templateLabel: template.label,
      }
  }
}

function toRecurrence(row: RecurrenceRow): Recurrence {
  return {
    id: asId<RecurrenceId>(row.id),
    template: toTemplate(row),
    amountKind: row.amountKind,
    startDate: isoDate(row.startDate),
    endsOn: row.endsOn ? isoDate(row.endsOn) : null,
    closedOn: row.closedOn ? isoDate(row.closedOn) : null,
  }
}

/* -------------------------------------------------------------------------
 * Recurrence repository
 * ---------------------------------------------------------------------- */

export function createRecurrenceRepository(db: BigornaDatabase): {
  reader: RecurrenceReader
  writer: RecurrenceWriter
} {
  const reader: RecurrenceReader = {
    async findById(userId: UserId, id: RecurrenceId) {
      const found = db
        .select()
        .from(recurrences)
        .where(and(eq(recurrences.userId, userId), eq(recurrences.id, id)))
        .get()
      return found ? toRecurrence(found) : null
    },

    async list(userId: UserId, page?: Page) {
      const query = db
        .select()
        .from(recurrences)
        .where(eq(recurrences.userId, userId))
        .orderBy(asc(recurrences.startDate), sql`rowid`)
      const rows =
        page === undefined ? query.all() : query.limit(page.limit).offset(page.offset).all()
      return rows.map(toRecurrence)
    },

    async count(userId: UserId) {
      const counted = db
        .select({ total: sql<number>`count(*)` })
        .from(recurrences)
        .where(eq(recurrences.userId, userId))
        .get()
      return counted?.total ?? 0
    },

    async listOpen(userId: UserId) {
      return db
        .select()
        .from(recurrences)
        .where(and(eq(recurrences.userId, userId), sql`${recurrences.closedOn} IS NULL`))
        .orderBy(asc(recurrences.startDate), sql`rowid`)
        .all()
        .map(toRecurrence)
    },
  }

  const writer: RecurrenceWriter = {
    async create(userId: UserId, value: NewRecurrence) {
      const id = randomUUID()
      try {
        db.insert(recurrences)
          .values({
            userId,
            id,
            amountKind: value.amountKind,
            startDate: value.startDate,
            endsOn: value.endsOn,
            closedOn: null,
            ...templateColumns(value.template),
          })
          .run()
      } catch (error) {
        throw translateReferenceViolation(error)
      }
      return { id: asId<RecurrenceId>(id), closedOn: null, ...value }
    },

    async replace(userId: UserId, value: Recurrence) {
      let result
      try {
        result = db
          .update(recurrences)
          .set({
            amountKind: value.amountKind,
            startDate: value.startDate,
            endsOn: value.endsOn,
            closedOn: value.closedOn,
            ...templateColumns(value.template),
          })
          .where(and(eq(recurrences.userId, userId), eq(recurrences.id, value.id)))
          .run()
      } catch (error) {
        throw translateReferenceViolation(error)
      }
      if (result.changes === 0) {
        throw new Error('recurrence.unknown_recurrence')
      }
      return value
    },

    async remove(userId: UserId, id: RecurrenceId) {
      try {
        db.delete(recurrences)
          .where(and(eq(recurrences.userId, userId), eq(recurrences.id, id)))
          .run()
      } catch (error) {
        // An entry or an occurrence still points at this série (RESTRICT).
        if (isForeignKeyViolation(error)) {
          throw new Error('recurrence.in_use')
        }
        throw error
      }
    },
  }

  return { reader, writer }
}

/* -------------------------------------------------------------------------
 * Occurrence repository
 * ---------------------------------------------------------------------- */

function toOccurrence(row: OccurrenceRow): Occurrence {
  return {
    id: asId<OccurrenceId>(row.id),
    recurrenceId: asId<RecurrenceId>(row.recurrenceId),
    month: row.month as Month,
    plannedDate: isoDate(row.plannedDate),
    plannedAmount: row.plannedAmount === null ? null : cents(row.plannedAmount),
    status: row.status,
    discarded: row.discarded,
    entryId: row.entryId ? asId<EntryId>(row.entryId) : null,
    ...(row.description !== null ? { description: row.description } : {}),
  }
}

function occurrenceColumns(value: NewOccurrence | Occurrence) {
  return {
    recurrenceId: value.recurrenceId,
    month: value.month,
    plannedDate: value.plannedDate,
    plannedAmount: value.plannedAmount,
    status: value.status,
    discarded: value.discarded,
    entryId: value.entryId,
    description: value.description?.trim() ? value.description.trim() : null,
  }
}

export function createOccurrenceRepository(db: BigornaDatabase): {
  reader: OccurrenceReader
  writer: OccurrenceWriter
} {
  function row(userId: UserId, id: OccurrenceId): OccurrenceRow | undefined {
    return db
      .select()
      .from(occurrences)
      .where(and(eq(occurrences.userId, userId), eq(occurrences.id, id)))
      .get()
  }

  const reader: OccurrenceReader = {
    async findById(userId: UserId, id: OccurrenceId) {
      const found = row(userId, id)
      return found ? toOccurrence(found) : null
    },

    async list(userId: UserId, page?: Page) {
      const query = db
        .select()
        .from(occurrences)
        .where(eq(occurrences.userId, userId))
        .orderBy(asc(occurrences.plannedDate), sql`rowid`)
      const rows =
        page === undefined ? query.all() : query.limit(page.limit).offset(page.offset).all()
      return rows.map(toOccurrence)
    },

    async count(userId: UserId) {
      const counted = db
        .select({ total: sql<number>`count(*)` })
        .from(occurrences)
        .where(eq(occurrences.userId, userId))
        .get()
      return counted?.total ?? 0
    },

    async listByMonth(userId: UserId, month: Month) {
      return db
        .select()
        .from(occurrences)
        .where(and(eq(occurrences.userId, userId), eq(occurrences.month, month)))
        .orderBy(asc(occurrences.plannedDate), sql`rowid`)
        .all()
        .map(toOccurrence)
    },

    async listByRecurrence(userId: UserId, recurrenceId: RecurrenceId) {
      return db
        .select()
        .from(occurrences)
        .where(and(eq(occurrences.userId, userId), eq(occurrences.recurrenceId, recurrenceId)))
        .orderBy(asc(occurrences.month), sql`rowid`)
        .all()
        .map(toOccurrence)
    },

    async listOpenByRecurrence(userId: UserId, recurrenceId: RecurrenceId) {
      return db
        .select()
        .from(occurrences)
        .where(
          and(
            eq(occurrences.userId, userId),
            eq(occurrences.recurrenceId, recurrenceId),
            eq(occurrences.status, 'Planned'),
            eq(occurrences.discarded, false),
          ),
        )
        .orderBy(asc(occurrences.month), sql`rowid`)
        .all()
        .map(toOccurrence)
    },
  }

  const writer: OccurrenceWriter = {
    async create(userId: UserId, value: NewOccurrence) {
      // Derived, not random (see file header): at most one occurrence exists
      // per (série, mês), so the id doubles as the natural key.
      const id = occurrenceIdFor(value.recurrenceId, value.month)
      db.insert(occurrences)
        .values({ userId, id, ...occurrenceColumns(value) })
        .onConflictDoNothing()
        .run()
      // Read back rather than trust `value`: a concurrent materialisation may
      // have won the race, and its (already Paga, already edited) row is the
      // one that must be returned, not the fresh Previsto this call proposed.
      return toOccurrence(row(userId, id)!)
    },

    async replace(userId: UserId, value: Occurrence) {
      const result = db
        .update(occurrences)
        .set(occurrenceColumns(value))
        .where(and(eq(occurrences.userId, userId), eq(occurrences.id, value.id)))
        .run()
      if (result.changes === 0) {
        throw new Error('occurrence.unknown_occurrence')
      }
      return value
    },

    async remove(userId: UserId, id: OccurrenceId) {
      db.delete(occurrences)
        .where(and(eq(occurrences.userId, userId), eq(occurrences.id, id)))
        .run()
    },

    /**
     * "Toda a série (valores em aberto)" writes every open occurrence of the
     * edit in one transaction (PRD UC14) — a partial write would leave the
     * série showing the new value on some months and the old one on others.
     */
    async replaceMany(userId: UserId, values: readonly Occurrence[]) {
      db.transaction((tx) => {
        for (const value of values) {
          const result = tx
            .update(occurrences)
            .set(occurrenceColumns(value))
            .where(and(eq(occurrences.userId, userId), eq(occurrences.id, value.id)))
            .run()
          if (result.changes === 0) {
            throw new Error('occurrence.unknown_occurrence')
          }
        }
      })
      return values
    },
  }

  return { reader, writer }
}
