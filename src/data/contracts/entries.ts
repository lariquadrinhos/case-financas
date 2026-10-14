/**
 * Lançamento — the ports the whole product reads through.
 *
 * `EntryReader` carries more than the generic three because the Lançamento is
 * the single source of truth: DRE, Balanço, Evolução Mensal and Indicadores are
 * all projections over it (docs/ARCHITECTURE.md §1), and every one of them asks
 * the same two questions — "the entries of this month" and "the entries matching
 * these filters".
 */

import type { Entry, EntryFilter, NewEntry } from '@/domain/entries'
import type { EntryId, Month } from '@/domain/core'
import type { Page, PagedResult, Reader, UserId, Writer } from './common'

export interface EntryReader extends Reader<Entry, EntryId> {
  /**
   * The seven filters of the Histórico (files_design/03). A `null` field is a
   * filter that is not applied — the adapter must not treat it as "match null".
   */
  search(userId: UserId, filter: EntryFilter, page?: Page): Promise<PagedResult<Entry>>
  /**
   * Every entry whose ACCOUNTING month is `month` — the month of the payment
   * date, never of a creation date (PRD §5). This is the query the reports run,
   * so it is a method and not a filter combination each caller re-derives.
   */
  listByMonth(userId: UserId, month: Month): Promise<readonly Entry[]>
  /** The entries a recurrence produced, for "Toda a série (valores em aberto)". */
  listByRecurrence(userId: UserId, recurrenceId: string): Promise<readonly Entry[]>
}

export type EntryWriter = Writer<Entry, NewEntry, EntryId>
