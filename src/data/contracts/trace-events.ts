/**
 * Eventos de rastreabilidade.
 *
 * Append only, and there is no writer method beyond `append`: the person never
 * edits the history, the system generates it (files_design/03). There is no
 * `remove` either — deleting an event is deleting the explanation of a number
 * that is still on screen.
 *
 * `TraceEvent.description` contains monetary amounts. It is product data and
 * must never be passed to `src/lib/log.ts` (ADR-0009 §3).
 */

import type { NewTraceEvent, TraceEvent } from '@/domain/trace-events'
import type { LiabilityId, RecurrenceId, TraceEventId } from '@/domain/core'
import type { Page, UserId } from './common'

export interface TraceEventReader {
  findById(userId: UserId, id: TraceEventId): Promise<TraceEvent | null>
  /** Newest first. The Home card "Eventos Recentes" takes the first five. */
  listRecent(userId: UserId, page?: Page): Promise<readonly TraceEvent[]>
  listByLiability(userId: UserId, liabilityId: LiabilityId): Promise<readonly TraceEvent[]>
  listByRecurrence(userId: UserId, recurrenceId: RecurrenceId): Promise<readonly TraceEvent[]>
}

export interface TraceEventWriter {
  append(userId: UserId, event: NewTraceEvent): Promise<TraceEvent>
}
