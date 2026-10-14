/**
 * Venda de Bem Material — computes gain/loss and what remains undirected
 * (files_design/01 §11, files_design/03 "Vender Bem Material").
 *
 * Ganho/perda is calculated here, never stored (src/domain/GLOSSARY.md,
 * `gainOrLoss`): the sale confirms it, the caller is the one who decides where
 * it is posted.
 *
 * What this function deliberately does NOT do: move money into the target of
 * an `Allocation` — bump an Investment's `accumulatedValue`, amortise a
 * Liability, or post a Revenue Lançamento. PRD v7 names "Redirecionamento" as a
 * single concept that still needs to become one operation across five screens
 * (Event Storming H12, explicitly unresolved: "Generalizar isso é decisão de
 * arquitetura, não só mais um `case`"). Resolving it here, for this one origin,
 * would invent the answer to a hotspot the sources leave open.
 */

import { add, isNegative, subtract } from '@/domain/core'
import type { Cents } from '@/domain/core'
import type { AssetSale, TangibleAsset } from './types'

export interface AssetSaleEvaluation {
  /** Venda − valor registrado, posted to Resultado Não Operacional by the caller. */
  readonly gainOrLoss: Cents
  readonly allocatedTotal: Cents
  /** What is left after the allocations — becomes a `PendingAllocation` when positive. */
  readonly pendingAmount: Cents
}

/**
 * Validates and evaluates a sale against the asset it targets.
 *
 * "A soma dos Direcionamentos nunca excede o valor de venda" (Event Storming
 * Fluxo L) is enforced here, once, so every caller gets the same rule instead
 * of re-deriving it at the edge.
 */
export function evaluateAssetSale(asset: TangibleAsset, sale: AssetSale): AssetSaleEvaluation {
  if (asset.id !== sale.tangibleAssetId) {
    throw new Error('asset_sale.asset_mismatch')
  }
  // A sold asset already left the Bens Materiais list (files_design/01 §11);
  // selling it again would recognise the same gain/perda twice.
  if (asset.soldOn !== null) {
    throw new Error('asset_sale.already_sold')
  }
  if (isNegative(sale.amount)) {
    throw new Error('asset_sale.negative_amount')
  }

  const allocatedTotal = add(...sale.allocations.map((allocation) => allocation.amount))
  if (allocatedTotal > sale.amount) {
    throw new Error('asset_sale.allocations_exceed_amount')
  }

  return {
    gainOrLoss: subtract(sale.amount, asset.recordedValue),
    allocatedTotal,
    pendingAmount: subtract(sale.amount, allocatedTotal),
  }
}
