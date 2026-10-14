/**
 * How one Lançamento reads as a single row — the client-side counterpart of
 * `src/api/entry-subject.ts` (which the server uses to name a `TraceEvent`'s
 * subject). Despesa/Receita have no Rótulo ("a Categoria já identifica o
 * lançamento", files_design/03), so the category name IS the row's name;
 * Pró-labore/Distribuição have neither Categoria nor Rótulo, so a fixed pt-BR
 * name stands in; IR keeps its own Rótulo when the person typed one.
 */

import { cents, formatMoney, isNegative, isZero, negate, type Cents } from '@/domain/core'

/**
 * Non-breaking space, so the sign never wraps away from the number it belongs
 * to — the same character `Intl` already puts between `R$` and the digits.
 */
const NBSP = '\u00a0'
import type { Entry, Category } from './types'

export function entryDisplayName(
  entry: Entry,
  categoriesById: ReadonlyMap<string, Category>,
): string {
  if (entry.kind === 'Expense' || entry.kind === 'Revenue') {
    return categoriesById.get(entry.categoryId)?.name ?? 'Lançamento'
  }
  switch (entry.kind) {
    case 'ProLabore':
      return 'Pró-labore'
    case 'ProfitDistribution':
      return 'Distribuição de lucro'
    case 'IncomeTax':
      return entry.label ?? 'Imposto de Renda'
  }
}

/**
 * The sign the Histórico row prints (files_design/08 §1: "− R$" never
 * parênteses, never cor). Despesa/Pró-labore/Distribuição always leave an
 * account; Receita always enters one; IR follows `direction` exactly like the
 * DRE's own projection does (`src/domain/entries/projection.ts`
 * `effectInView`, `IncomeTax` branch: a `Refund` gives back, a `Payment`
 * takes).
 */
export function entrySignedAmount(entry: Entry): Cents {
  // `entry.amount` is a plain `number` on the wire (no brand survives JSON) —
  // `cents()` is the same boundary cast every route already applies to a
  // request body before handing it to domain code.
  const amount = cents(entry.amount)
  switch (entry.kind) {
    case 'Revenue':
      return amount
    case 'IncomeTax':
      return entry.direction === 'Refund' ? amount : negate(amount)
    case 'Expense':
    case 'ProLabore':
    case 'ProfitDistribution':
      return negate(amount)
  }
}

/**
 * Signed money for the Histórico's own "entrada positiva / saída negativa"
 * reading of a Lançamento.
 *
 * The Histórico is the ONE table that prints the sign on both directions: the
 * Figma's Valor column reads `− R$ 184,90` for a despesa and `+ R$ 3.200,00`
 * for a receita (frame `9:2`, cells `9:75` / `9:90`), because a column that
 * mixes money leaving and money entering has to say which is which. Elsewhere
 * a positive number carries no sign, so the plus is added here, on the screen
 * that draws it, and never inside `formatMoney`.
 *
 * The typographic-minus substitution that used to live here moved into
 * `@/domain/core`'s `formatMoney`: files_design/08 §1 ("Negativo usa o sinal −,
 * menos tipográfico") is a rule about every number the product prints, not
 * about one screen, and applying it per screen let the Home print an ASCII
 * hyphen in "Patrimônio Líquido".
 *
 * Zero takes no sign — it neither entered nor left.
 */
export function formatSignedMoney(value: Cents): string {
  if (isZero(value)) return formatMoney(value)
  const magnitude = formatMoney(isNegative(value) ? negate(value) : value)
  return `${isNegative(value) ? '−' : '+'}${NBSP}${magnitude}`
}
