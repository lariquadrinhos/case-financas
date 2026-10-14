/**
 * Recorrência — the template that generates one Previsto occurrence per month
 * (PRD §5 "Motor de recorrência", Event Storming Fluxo D, hotspot H4).
 *
 * The occurrence is a separate record from the Lançamento it eventually becomes:
 * it can be edited, discarded for a single month, or left pending with no
 * amount, none of which should touch the DRE — only a `Paid` entry does.
 */

import type {
  Cents,
  EntryId,
  EntryStatus,
  IsoDate,
  Month,
  OccurrenceId,
  RecurrenceAmountKind,
  RecurrenceId,
} from '@/domain/core'
import type { DistributiveOmit, Entry } from '@/domain/entries'

/**
 * The entry data copied into every occurrence. It carries the kind and its
 * kind-specific fields (category, accounts, entity...), but not the fields that
 * belong to a single month: the date, the status and the recurrence link are
 * built per occurrence.
 *
 * `amount` is the value the person typed when creating the series. It is copied
 * into the occurrence only when `amountKind` is `Fixed`; a `ToBeDefined` series
 * is born blank every month (PRD §5).
 */
export type RecurrenceTemplate = DistributiveOmit<
  Entry,
  'id' | 'date' | 'status' | 'recurrenceId' | 'accountingMonth'
>

export interface Recurrence {
  readonly id: RecurrenceId
  readonly template: RecurrenceTemplate
  readonly amountKind: RecurrenceAmountKind
  /** First occurrence. Later occurrences keep this day of month (`sameDayInAnotherMonth`). */
  readonly startDate: IsoDate
  /**
   * "Término (data da última ocorrência)". `null` is an open-ended series that
   * runs until it is closed; a date covers a parcelamento of N months
   * (PRD UC15, files_design/03 "Objeto Recorrência").
   */
  readonly endsOn: IsoDate | null
  /**
   * Set by "Encerrar recorrência", which stops the series for good — different
   * from "Descartar", which skips a single month (files_design/04).
   */
  readonly closedOn: IsoDate | null
}

export interface Occurrence {
  readonly id: OccurrenceId
  readonly recurrenceId: RecurrenceId
  /** The month this occurrence belongs to in the Revisão de Recorrentes list. */
  readonly month: Month
  readonly plannedDate: IsoDate
  /**
   * `null` while a `ToBeDefined` series has not been filled in. It stays
   * Previsto and pending — it never blocks the month, because Previsto does not
   * enter the DRE (PRD §1).
   */
  readonly plannedAmount: Cents | null
  readonly status: EntryStatus
  /** "Descartar": skipped this month only; the series continues next month. */
  readonly discarded: boolean
  /** The Lançamento created when the occurrence was marked Pago. */
  readonly entryId: EntryId | null
  /**
   * This month's own Descrição, set by "Só esta ocorrência" (2026-10-01).
   * Absent or `null`: the series' `template.description` applies.
   */
  readonly description?: string | null
}

/**
 * PRD UC14 — editing one occurrence asks which reach the change has.
 * "Toda a série (valores em aberto)" is status-based, not time-based: it reaches
 * every occurrence still Previsto, including a late one (files_design/02).
 */
export const EDIT_SCOPES = ['ThisOnly', 'WholeSeries'] as const
export type EditScope = (typeof EDIT_SCOPES)[number]

export const LABEL_EDIT_SCOPE: Record<EditScope, string> = {
  ThisOnly: 'Só esta ocorrência',
  WholeSeries: 'Toda a série (valores em aberto)',
}
