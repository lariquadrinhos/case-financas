/**
 * "Vender Bem Material" — files_design/03 "Vender Bem Material": "soma dos
 * valores não pode exceder o valor de venda" and "Objeto Direcionamento":
 * "[Valor a alocar] não pode exceder o Restante disponível no momento".
 *
 * Pulled out of `VenderBemMaterialDialog` as pure functions so the rule this
 * screen enforces client-side (before the round trip to
 * `POST /tangible-assets/{id}/sale`, which enforces the same thing server-side
 * in `evaluateAssetSale`, `src/domain/assets/sale.ts`) has one place to be
 * tested without rendering the whole dialog.
 */

import { add, subtract, type Cents } from '@/domain/core'

/** "Restante" — o valor de venda menos o que já foi direcionado. */
export function remainingToAllocate(
  saleAmount: Cents,
  allocations: readonly { readonly amount: Cents }[],
): Cents {
  const allocatedTotal = add(...allocations.map((allocation) => allocation.amount))
  return subtract(saleAmount, allocatedTotal)
}

/**
 * Whether a NEW direcionamento of `amount` still fits inside `remaining`.
 * Zero and negative amounts are refused too — "Valor a alocar" is required
 * and a direcionamento of nothing is not a direcionamento.
 */
export function fitsWithinRemaining(amount: Cents, remaining: Cents): boolean {
  return amount > 0 && amount <= remaining
}
