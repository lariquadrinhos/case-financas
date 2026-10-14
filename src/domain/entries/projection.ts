/**
 * Projeção do Lançamento por Visão — the intercompany engine (PRD §5, H2).
 *
 * One entry, three readings. The same Lançamento is revenue in one view, an
 * operating expense in another and nothing at all in the consolidated one; it is
 * never duplicated (PRD §5: "lançamento único por transação, com entidade como
 * atributo"). This file is the single place that decides which of the three it
 * is — every report projects through `effectInView` instead of re-deriving the
 * rule, so the elimination cannot drift between the DRE, the Balanço and the
 * Evolução Mensal.
 *
 * It deliberately does NOT name blocks of the Plano de Contas: `entries` may not
 * import `chart-of-accounts` (src/domain/README.md, "A regra de dependência").
 * It names the accounting ROLE, and `reports` resolves the role to a block.
 */

import { negate, type Cents, type View } from '@/domain/core'

import type { Entry } from './types'

/**
 * The accounting role an entry takes in a given view.
 *
 * `Category` means "the entry carries a Categoria and the block comes from it"
 * — the ordinary despesa/receita. The other four are the roles the forms cannot
 * express as a category: an intercompany entry has no Categoria field
 * (files_design/03 "Aba Pró-labore e Distribuição") and neither does IR
 * (files_design/03 "Aba IR").
 */
export const ENTRY_ROLES = [
  'Category',
  'GrossRevenue',
  'OperatingExpense',
  'ProfitAllocation',
  'ProfitTaxes',
] as const
export type EntryRole = (typeof ENTRY_ROLES)[number]

/** Why an entry produced no effect in the view — the DRE uses it to explain itself. */
export const EXCLUSION_REASONS = ['OtherEntity', 'IntercompanyElimination'] as const
export type ExclusionReason = (typeof EXCLUSION_REASONS)[number]

export type EntryEffect =
  | { readonly kind: 'Excluded'; readonly reason: ExclusionReason }
  | {
      readonly kind: 'Included'
      readonly role: EntryRole
      /**
       * Signed contribution to the profit, in "profit terms": revenue adds,
       * expense subtracts. It is NOT what the DRE prints — the cascade prints
       * each block in its own reading direction, `(-) Deduções da Receita`
       * being a positive number under a minus sign (Figma 11:2). Converting one
       * into the other is the report's job, because only the report knows the
       * block's `CascadeEffect`.
       */
      readonly contribution: Cents
    }

function included(role: EntryRole, contribution: Cents): EntryEffect {
  return { kind: 'Included', role, contribution }
}

function excluded(reason: ExclusionReason): EntryEffect {
  return { kind: 'Excluded', reason }
}

/**
 * How `entry` reads in `view`.
 *
 * Intercompany (PRD §1 "Nota intercompany", Event Storming Fluxo C):
 * - pró-labore — PJ: despesa operacional, reduces the profit; PF: receita.
 * - distribuição de lucro — PJ: apropriação do lucro já apurado (bloco 10,
 *   below the line, does NOT reduce the operating profit); PF: receita.
 * - both are ELIMINATED in the consolidated view, so the same money is not
 *   counted twice.
 * Dividends from external investments are ordinary revenue and never reach this
 * branch: they are `Revenue` entries with a Categoria in bloco 1.
 */
export function effectInView(entry: Entry, view: View): EntryEffect {
  switch (entry.kind) {
    case 'Expense':
      return isOutOfView(entry.entity, view)
        ? excluded('OtherEntity')
        : included('Category', negate(entry.amount))

    case 'Revenue':
      return isOutOfView(entry.entity, view)
        ? excluded('OtherEntity')
        : included('Category', entry.amount)

    case 'IncomeTax':
      if (isOutOfView(entry.entity, view)) return excluded('OtherEntity')
      // "pagamento ou recebimento" (PRD §5): a refund is a negative tax, so it
      // gives back profit instead of taking it.
      return included(
        'ProfitTaxes',
        entry.direction === 'Payment' ? negate(entry.amount) : entry.amount,
      )

    case 'ProLabore':
      if (view === 'Consolidated') return excluded('IntercompanyElimination')
      return view === 'PF'
        ? included('GrossRevenue', entry.amount)
        : included('OperatingExpense', negate(entry.amount))

    case 'ProfitDistribution':
      if (view === 'Consolidated') return excluded('IntercompanyElimination')
      return view === 'PF'
        ? included('GrossRevenue', entry.amount)
        : included('ProfitAllocation', negate(entry.amount))
  }
}

/** The consolidated view sees both entities; PF and PJ see only their own. */
function isOutOfView(entity: 'PF' | 'PJ', view: View): boolean {
  return view !== 'Consolidated' && view !== entity
}
