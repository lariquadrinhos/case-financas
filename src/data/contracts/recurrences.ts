/**
 * Recorrência e Ocorrência.
 *
 * ADR-0004 §3: a ocorrência é materializada na PRIMEIRA VISITA ao mês, e por
 * isso `create` tem de ser um get-or-create por (série, mês) — um `insert` puro
 * duplicaria na segunda visita. A porta é escrita para linha materializada
 * porque é a forma que um repositório pode oferecer; o motor continua gerando
 * virtualmente (ADR-0004 §1), e é o id derivado do par (§2) que costura as
 * duas.
 */

import type { Occurrence, Recurrence } from '@/domain/recurrence'
import type { Month, OccurrenceId, RecurrenceId } from '@/domain/core'
import type { Reader, UserId, Writer } from './common'

export type NewRecurrence = Omit<Recurrence, 'id' | 'closedOn'>
export type NewOccurrence = Omit<Occurrence, 'id'>

export interface RecurrenceReader extends Reader<Recurrence, RecurrenceId> {
  /** The series still producing occurrences: `closedOn` is null. */
  listOpen(userId: UserId): Promise<readonly Recurrence[]>
}

export type RecurrenceWriter = Writer<Recurrence, NewRecurrence, RecurrenceId>

export interface OccurrenceReader extends Reader<Occurrence, OccurrenceId> {
  /** The Revisão de Recorrentes list for one month. */
  listByMonth(userId: UserId, month: Month): Promise<readonly Occurrence[]>
  listByRecurrence(userId: UserId, recurrenceId: RecurrenceId): Promise<readonly Occurrence[]>
  /**
   * Every occurrence still Previsto, in any month. This is what "Toda a série
   * (valores em aberto)" reaches — status-based, not time-based, so a late
   * occurrence is included (files_design/02).
   */
  listOpenByRecurrence(userId: UserId, recurrenceId: RecurrenceId): Promise<readonly Occurrence[]>
}

export interface OccurrenceWriter extends Writer<Occurrence, NewOccurrence, OccurrenceId> {
  /** Editing a whole series is one transaction, for the same reason a schedule is. */
  replaceMany(userId: UserId, occurrences: readonly Occurrence[]): Promise<readonly Occurrence[]>
}
