/**
 * Evento de rastreabilidade — the SQLite adapter for
 * `src/data/contracts/trace-events.ts`.
 *
 * Append-only (files_design/03: "a pessoa não edita o histórico") — there is no
 * `replace` and no `remove` here, on purpose: deleting an event would delete the
 * explanation of a number still on screen.
 *
 * `description` carries a monetary amount in plain text ("Parcela #12 paga:
 * previsto R$ 1.520,00..."). It is product data read straight from the row —
 * never routed through `@/lib/log` (ADR-0009 §3).
 */

import { randomUUID } from 'node:crypto'

import { and, desc, eq } from 'drizzle-orm'

import type { NewTraceEvent, TraceEvent, TraceEventOrigin } from '@/domain/trace-events'
import {
  asId,
  type BankAccountId,
  type EntryId,
  type InvestmentId,
  type IsoDate,
  type LiabilityId,
  type RecurrenceId,
  type TraceEventId,
} from '@/domain/core'
import type { TraceEventReader, TraceEventWriter } from '@/data/contracts/trace-events'
import type { Page, UserId } from '@/data/contracts/common'
import type { BigornaDatabase } from './client'
import { traceEvents } from './schema'

type TraceEventRow = typeof traceEvents.$inferSelect

function toOrigin(row: TraceEventRow): TraceEventOrigin {
  // `trace_events_origin_shape` (schema.ts) guarantees the paired column is
  // set whenever `originKind` says so.
  switch (row.originKind) {
    case 'Liability':
      return { kind: 'Liability', liabilityId: asId<LiabilityId>(row.originLiabilityId!) }
    case 'Recurrence':
      return { kind: 'Recurrence', recurrenceId: asId<RecurrenceId>(row.originRecurrenceId!) }
    case 'Entry':
      return { kind: 'Entry', entryId: asId<EntryId>(row.originEntryId!) }
    case 'BankAccount':
      return {
        kind: 'BankAccount',
        bankAccountId: asId<BankAccountId>(row.originBankAccountId!),
      }
    case 'Investment':
      return { kind: 'Investment', investmentId: asId<InvestmentId>(row.originInvestmentId!) }
  }
}

function toTraceEvent(row: TraceEventRow): TraceEvent {
  return {
    id: asId<TraceEventId>(row.id),
    date: row.date as IsoDate,
    kind: row.kind,
    origin: toOrigin(row),
    description: row.description,
  }
}

export function createTraceEventRepository(db: BigornaDatabase): {
  reader: TraceEventReader
  writer: TraceEventWriter
} {
  const reader: TraceEventReader = {
    async findById(userId: UserId, id: TraceEventId) {
      const row = db
        .select()
        .from(traceEvents)
        .where(and(eq(traceEvents.userId, userId), eq(traceEvents.id, id)))
        .get()
      return row ? toTraceEvent(row) : null
    },

    // Newest first — the Home card "Eventos Recentes" takes the first five
    // (files_design/03).
    async listRecent(userId: UserId, page?: Page) {
      const query = db
        .select()
        .from(traceEvents)
        .where(eq(traceEvents.userId, userId))
        .orderBy(desc(traceEvents.date))
      const rows =
        page === undefined ? query.all() : query.limit(page.limit).offset(page.offset).all()
      return rows.map(toTraceEvent)
    },

    async listByLiability(userId: UserId, liabilityId: LiabilityId) {
      const rows = db
        .select()
        .from(traceEvents)
        .where(and(eq(traceEvents.userId, userId), eq(traceEvents.originLiabilityId, liabilityId)))
        .orderBy(desc(traceEvents.date))
        .all()
      return rows.map(toTraceEvent)
    },

    async listByRecurrence(userId: UserId, recurrenceId: RecurrenceId) {
      const rows = db
        .select()
        .from(traceEvents)
        .where(
          and(eq(traceEvents.userId, userId), eq(traceEvents.originRecurrenceId, recurrenceId)),
        )
        .orderBy(desc(traceEvents.date))
        .all()
      return rows.map(toTraceEvent)
    },
  }

  const writer: TraceEventWriter = {
    async append(userId: UserId, event: NewTraceEvent) {
      const id = randomUUID()
      db.insert(traceEvents)
        .values({
          userId,
          id,
          date: event.date,
          kind: event.kind,
          originKind: event.origin.kind,
          originLiabilityId: event.origin.kind === 'Liability' ? event.origin.liabilityId : null,
          originRecurrenceId: event.origin.kind === 'Recurrence' ? event.origin.recurrenceId : null,
          originEntryId: event.origin.kind === 'Entry' ? event.origin.entryId : null,
          originBankAccountId:
            event.origin.kind === 'BankAccount' ? event.origin.bankAccountId : null,
          originInvestmentId: event.origin.kind === 'Investment' ? event.origin.investmentId : null,
          description: event.description,
        })
        .run()
      return { id: asId<TraceEventId>(id), ...event }
    },
  }

  return { reader, writer }
}
