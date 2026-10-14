/**
 * ADR-0019 — converting a série created BEFORE the decision (start in the
 * month after its origin lançamento) to the current shape (start in the
 * origin's own month, the origin being that month's occurrence).
 *
 * Pure: it only says what to write. `scripts/convert-series-adr0019.ts`
 * applies it, one série per transaction.
 */
import { monthOf, previousMonth } from '@/domain/core'
import type { Entry } from '@/domain/entries'
import { occurrenceOfMonth, startMonthOf } from './engine'
import type { Occurrence, Recurrence } from './types'

export interface SeriesConversion {
  readonly recurrence: Recurrence
  readonly firstOccurrence: Omit<Occurrence, 'id'>
  /** The origin entry, removed when it was Previsto — the occurrence now IS it. */
  readonly removeEntryId: Entry['id'] | null
}

/**
 * `null` when there is nothing to convert: no origin entry in the month right
 * before the série's start. That is also what makes the conversion idempotent —
 * a converted série starts in its origin's month, so there is no such entry.
 *
 * The origin is the série's entry that no occurrence points to (an entry
 * produced by "Marcar Pago" is pointed to by its occurrence).
 */
export function planSeriesConversion(
  recurrence: Recurrence,
  entriesOfSeries: readonly Entry[],
  occurrencesOfSeries: readonly Occurrence[],
): SeriesConversion | null {
  const linked = new Set(occurrencesOfSeries.map((occurrence) => occurrence.entryId))
  const monthBefore = previousMonth(startMonthOf(recurrence))
  const origins = entriesOfSeries.filter(
    (entry) =>
      entry.recurrenceId === recurrence.id &&
      !linked.has(entry.id) &&
      monthOf(entry.date) === monthBefore,
  )
  if (origins.length !== 1) return null
  const origin = origins[0]!

  const converted: Recurrence = { ...recurrence, startDate: origin.date }
  const occurrence = occurrenceOfMonth(converted, monthOf(origin.date))
  if (occurrence === null) return null
  const { id: _id, ...base } = occurrence

  return origin.status === 'Paid'
    ? {
        recurrence: converted,
        firstOccurrence: {
          ...base,
          status: 'Paid',
          plannedAmount: origin.amount,
          entryId: origin.id,
        },
        removeEntryId: null,
      }
    : {
        recurrence: converted,
        firstOccurrence: {
          ...base,
          status: 'Planned',
          plannedAmount: origin.amount,
          entryId: null,
        },
        removeEntryId: origin.id,
      }
}
