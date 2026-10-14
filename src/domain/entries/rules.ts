/**
 * Entry rules — the month, the status filter, the Histórico filters, and
 * marking an entry paid.
 *
 * The intercompany projection is NOT here: it lives in `projection.ts`, which is
 * the single place that decides how an entry reads in each view. Re-deriving it
 * here would let the elimination drift between the DRE and the Histórico, which
 * is exactly the failure H2 warns about.
 */

import {
  INTERCOMPANY_KINDS,
  type Cents,
  type EntryStatus,
  type IsoDate,
  type Month,
  type View,
  ZERO,
  isNegative,
  monthOf,
  negate,
  subtract,
} from '@/domain/core'
import { effectInView } from './projection'
import type { Entry, EntryFilter } from './types'

/**
 * The accounting month of an entry.
 *
 * PRD §5: the month of the payment date the person entered — never the
 * creation date, never a posting date. ADR-0021 adds the one other candidate:
 * a despesa's "Contabilizar em", which the person chose. This one function is
 * the whole rule; every report reads the month through it.
 */
export function accountingMonth(entry: Entry): Month {
  if (entry.kind === 'Expense' && entry.accountingMonth) return entry.accountingMonth
  return monthOf(entry.date)
}

/**
 * Whether an entry counts towards the cascade under the current toggle.
 *
 * PRD §1: a Previsto entry is a plan and does NOT enter the realised DRE —
 * the "Pago" toggle shows only what was paid. "Previsto" is the complete
 * forecast of the month: what was paid plus what is still planned (owner,
 * 2026-10-09: "o filtro Previsto deveria contabilizar o pago também", "quero
 * minha previsão completa"). It was exclusive until then (files_design/01
 * §8.1), and a month half paid showed only the half still to come.
 */
export function entersIncomeStatement(
  entry: Pick<Entry, 'status'>,
  statusFilter: EntryStatus,
): boolean {
  return statusFilter === 'Planned' || entry.status === 'Paid'
}

/** Whether the entry shows up at all in a view. */
export function visibleInView(entry: Entry, view: View): boolean {
  return effectInView(entry, view).kind === 'Included'
}

/**
 * The seven filters of the Histórico screen (files_design/03 "Histórico —
 * filtros"). A `null` filter is not applied.
 *
 * The entity filter is a `View`, not an `Entity`, because the screen offers
 * "Consolidado" alongside PF and PJ — and Consolidado is not a third entity, it
 * is the elimination rule. Filtering by it therefore runs the same
 * `effectInView` the reports use, so the Histórico cannot list a pró-labore
 * that the DRE eliminates.
 */
export function filterEntries(entries: readonly Entry[], filter: EntryFilter): Entry[] {
  return entries.filter((entry) => {
    if (filter.status !== null && entry.status !== filter.status) return false
    if (filter.month !== null && accountingMonth(entry) !== filter.month) return false
    if (filter.view !== null && !visibleInView(entry, filter.view)) return false
    if (filter.recurring !== null && (entry.recurrenceId !== null) !== filter.recurring)
      return false

    // The remaining three filters name fields that only some kinds carry. An
    // entry without the field does not "pass by default": a pró-labore has no
    // Categoria, so filtering by category must exclude it.
    if (filter.categoryId !== null) {
      if (!('categoryId' in entry) || entry.categoryId !== filter.categoryId) return false
    }
    if (filter.classification !== null) {
      if (!('classification' in entry) || entry.classification !== filter.classification) {
        return false
      }
    }
    if (filter.bankAccountId !== null) {
      const accounts =
        'bankAccountId' in entry
          ? [entry.bankAccountId]
          : [entry.sourceAccountId, entry.destinationAccountId]
      if (!accounts.includes(filter.bankAccountId)) return false
    }
    return true
  })
}

/* -------------------------------------------------------------------------
 * Marcar Pago
 * ---------------------------------------------------------------------- */

/**
 * What the person may do with money paid ABOVE the planned amount
 * (files_design/03 "Marcar Pago"). There is no fourth option, and none of these
 * is a Pendência — see `PaymentOutcome`.
 */
export const OVERPAYMENT_CHOICES = ['DeductFromNext', 'RedirectExtra', 'NoAction'] as const
export type OverpaymentChoice = (typeof OVERPAYMENT_CHOICES)[number]

export const LABEL_OVERPAYMENT_CHOICE: Record<OverpaymentChoice, string> = {
  DeductFromNext: 'Descontar da próxima ocorrência',
  RedirectExtra: 'Redirecionar o valor extra',
  NoAction: 'Manter sem ação',
}

/**
 * The result of marking an entry paid.
 *
 * files_design/03 defines two DIFFERENT behaviours depending on the sign of the
 * difference, and collapsing them into one "discrepancy" is the likeliest bug
 * in this module:
 *
 *   paid < planned → the shortfall becomes its OWN pending item on the Home,
 *                    one per discrepancy, never summed with the others.
 *   paid > planned → NEVER becomes pending. The person chooses between
 *                    deducting from the next occurrence, redirecting the extra,
 *                    or doing nothing.
 *
 * Both cases produce a TraceEvent; only the first produces a pending item.
 */
export type PaymentOutcome =
  | { readonly kind: 'Exact' }
  | { readonly kind: 'Underpaid'; readonly shortfall: Cents; readonly becomesPending: true }
  | { readonly kind: 'Overpaid'; readonly excess: Cents; readonly becomesPending: false }

export interface MarkAsPaidResult {
  readonly entry: Entry
  readonly outcome: PaymentOutcome
}

/**
 * The divergence between what was paid and what was planned, as a
 * `PaymentOutcome`. Pulled out of `markAsPaid` so the SAME asymmetry (§ above)
 * governs marking a Lançamento paid AND marking a recurrence occurrence paid
 * (`@/domain/recurrence` `payOccurrence`) — the rule must not be re-derived per
 * caller, only the record each one produces differs.
 */
export function paymentOutcomeOf(paidAmount: Cents, plannedAmount: Cents): PaymentOutcome {
  const difference = subtract(paidAmount, plannedAmount)
  if (difference === ZERO) return { kind: 'Exact' }
  return isNegative(difference)
    ? { kind: 'Underpaid', shortfall: negate(difference), becomesPending: true }
    : { kind: 'Overpaid', excess: difference, becomesPending: false }
}

export function markAsPaid(
  entry: Entry,
  paidAmount: Cents,
  paymentDate: IsoDate,
): MarkAsPaidResult {
  if (isNegative(paidAmount)) {
    throw new Error('entries.negative_paid_amount')
  }

  return {
    // The paid amount replaces the planned one, and the payment date decides the
    // accounting month — which may differ from the month it was planned in.
    entry: { ...entry, amount: paidAmount, date: paymentDate, status: 'Paid' },
    outcome: paymentOutcomeOf(paidAmount, entry.amount),
  }
}

/* -------------------------------------------------------------------------
 * Editar (Histórico, DRE "Lançamentos deste mês")
 * ---------------------------------------------------------------------- */

/**
 * Applies a partial edit to an entry (files_design/03 "Histórico — filtros":
 * clicking a row opens Novo Lançamento pré-preenchido with the same form).
 *
 * `kind` is required in the patch and MUST match the target's own kind — the
 * one exception is the Sub-tipo switch below (`isSubKindSwitch`)
 * (src/api/contracts/entries.ts "EntryPatch": "a pró-labore que se torna uma
 * despesa é uma transação diferente, apagada e recriada"). Without this guard a
 * client could send a validly-shaped Despesa patch body at a stored Pró-labore
 * and silently overwrite its natureza, which the API deliberately does not
 * offer as an edit.
 */
/**
 * Pró-labore ↔ Distribuição de lucro is the Sub-tipo of ONE tab (files_design/03
 * "Aba Pró-labore e Distribuição"), with the same fields — switching it fixes
 * what was typed, it is not a different transaction. Product decision,
 * 2026-09-23: the Editar used to answer 409 and the person had no way out.
 */
export function isSubKindSwitch(from: Entry['kind'], to: Entry['kind']): boolean {
  const intercompany: readonly Entry['kind'][] = INTERCOMPANY_KINDS
  return intercompany.includes(from) && intercompany.includes(to)
}

export function applyEntryPatch(
  entry: Entry,
  patch: Partial<Entry> & { kind: Entry['kind'] },
): Entry {
  if (patch.kind !== entry.kind && !isSubKindSwitch(entry.kind, patch.kind)) {
    throw new Error('entries.patch_changes_kind')
  }
  return { ...entry, ...patch } as Entry
}
