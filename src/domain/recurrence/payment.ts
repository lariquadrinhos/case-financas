/**
 * Marcar uma ocorrência como paga (PRD UC24, UC26; files_design/03 "Marcar
 * Pago" applied to the Revisão de Recorrentes).
 *
 * This is NOT `markAsPaid` from `@/domain/entries`: that function pays an entry
 * that already exists. An occurrence has no Lançamento yet — Previsto never
 * enters the DRE (PRD §1) — so paying one CREATES the entry instead of editing
 * one. What both share is the shortfall/excess asymmetry, which is why this
 * module calls `paymentOutcomeOf` rather than re-deriving it (the failure H2-style
 * warns against: the same rule drifting between two callers).
 *
 * The result carries a `NewEntry`, not an `Entry`: ids are assigned by the
 * WRITER (src/data/contracts/common.ts), and this function is pure — it cannot
 * invent the entry's id before the repository has stored it. The caller
 * completes the occurrence with `occurrencePaidWith` once that id is known.
 */

import { isNegative, type Cents, type EntryId, type IsoDate } from '@/domain/core'
import { paymentOutcomeOf, type NewEntry, type PaymentOutcome } from '@/domain/entries'
import { isOpen } from './engine'
import type { Occurrence, Recurrence } from './types'

export interface PayOccurrenceCommand {
  readonly recurrence: Recurrence
  readonly occurrence: Occurrence
  readonly paidAmount: Cents
  readonly paymentDate: IsoDate
}

export interface PayOccurrenceResult {
  readonly newEntry: NewEntry
  /**
   * `null` when there was nothing to compare against — a "a definir" occurrence
   * paid for the first time (`plannedAmount` is `null`, PRD §5). There is no
   * planned value to diverge from, so this is neither Exact nor a discrepancy.
   */
  readonly outcome: PaymentOutcome | null
}

/**
 * The Descrição of one month of a series: the month's own ("Só esta
 * ocorrência", 2026-10-01) over the series'. `null` when neither has one.
 */
export function occurrenceDescription(
  occurrence: Pick<Occurrence, 'description'>,
  recurrence: Pick<Recurrence, 'template'>,
): string | null {
  return occurrence.description || recurrence.template.description || null
}

/**
 * Builds what marking `occurrence` paid produces. Guards mirror
 * `editOccurrence` on purpose: an occurrence must belong to the series it is
 * paid through and must still be open — a Pago or Descartada occurrence is not
 * payable again.
 */
export function payOccurrence(command: PayOccurrenceCommand): PayOccurrenceResult {
  const { recurrence, occurrence, paidAmount, paymentDate } = command

  if (occurrence.recurrenceId !== recurrence.id) {
    throw new Error('recurrence.occurrence_of_another_series')
  }
  if (!isOpen(occurrence)) {
    throw new Error('recurrence.occurrence_not_open')
  }
  if (isNegative(paidAmount)) {
    throw new Error('entries.negative_paid_amount')
  }

  const newEntry: NewEntry = {
    ...recurrence.template,
    amount: paidAmount,
    date: paymentDate,
    status: 'Paid',
    recurrenceId: recurrence.id,
    description: occurrenceDescription(occurrence, recurrence),
  } as NewEntry

  const outcome =
    occurrence.plannedAmount === null
      ? null
      : paymentOutcomeOf(paidAmount, occurrence.plannedAmount)

  return { newEntry, outcome }
}

/**
 * The occurrence's own record of having been paid, once the entry it produced
 * has an id. Kept separate from `payOccurrence` for the reason above: this
 * function needs the id the writer assigned, and `payOccurrence` runs before
 * that id exists.
 */
export function occurrencePaidWith(
  occurrence: Occurrence,
  entryId: EntryId,
  paidAmount: Cents,
): Occurrence {
  return { ...occurrence, status: 'Paid', plannedAmount: paidAmount, entryId }
}
