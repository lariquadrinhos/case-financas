/**
 * Destinar o Lucro — the rules of the screen (files_design/01 §9,
 * files_design/03 "Destinar o Lucro").
 *
 * Scope: one single CONSOLIDATED amount, never split per entity. This is the
 * deliberate exception to the general "entity as an attribute" rule, and the
 * reason is written in files_design/02 ("Princípios gerais"): destining the
 * profit is a decision about the *combined* result, not a transaction of the PF
 * or of the PJ. Every function here therefore takes one `ProfitAllocation` and
 * no `Entity` and no `View`.
 *
 * Two rules of the spec pull in opposite directions and both are implemented
 * literally:
 *  - a leftover does NOT block saving (files_design/01 §9, files_design/02
 *    "Destinação do Lucro não trava mesmo com saldo não alocado") — it becomes
 *    a Pendência on the Home instead;
 *  - the sum of the items may NOT exceed the net profit (files_design/03
 *    "soma dos itens não pode exceder o lucro líquido") — that one blocks.
 */

import { add, percentOf, subtract } from '@/domain/core'
import type { Cents, Month } from '@/domain/core'

import { ALLOCATION_BUCKETS, DESTINATION_KIND_BY_BUCKET, EMPTY_ALLOCATION_ITEMS } from './types'
import type {
  AllocationBucket,
  AllocationDestination,
  AllocationItem,
  ProfitAllocation,
  UnallocatedProfitPendingItem,
} from './types'

/**
 * A loss has nothing to destine: the card disappears from the DRE and turns
 * into "Sem lucro a destinar este mês" (files_design/01 §8.1 and §9).
 *
 * Zero is refused for the same reason, and that is decided, not assumed: the
 * Figma note `242:14` (Wireframe, frame `242:2` "Estado — DRE com Prejuízo")
 * writes the rule with its criterion — «"Destinar este Lucro" some quando o
 * resultado é negativo — não faz sentido oferecer alocação de algo que não
 * existe». With a net profit of zero there is no value that exists to allocate,
 * so the threshold is `> 0`.
 */
export function canAllocate(netProfit: Cents): boolean {
  return netProfit > 0
}

/** The state the screen opens in: the four cards, all empty (files_design/03). */
export function emptyAllocation(month: Month, netProfit: Cents): ProfitAllocation {
  return { month, netProfit, items: EMPTY_ALLOCATION_ITEMS }
}

export function bucketItems(
  allocation: ProfitAllocation,
  bucket: AllocationBucket,
): readonly AllocationItem[] {
  return allocation.items[bucket]
}

/** The "subtotal (valor + % do lucro) no cabeçalho" of one card (files_design/01 §9). */
export function bucketSubtotal(allocation: ProfitAllocation, bucket: AllocationBucket): Cents {
  return add(...allocation.items[bucket].map((item) => item.amount))
}

/** Every item of every card — what "a soma de todos os itens" means. */
export function allocatedTotal(allocation: ProfitAllocation): Cents {
  return add(...ALLOCATION_BUCKETS.map((bucket) => bucketSubtotal(allocation, bucket)))
}

/**
 * "Saldo não alocado" = net profit − the sum of every item of every card
 * (files_design/03). Derived on every read, never stored: the screen updates it
 * "em tempo real" (files_design/01 §9), and a stored copy would be one edit
 * away from disagreeing with the items it summarises.
 */
export function unallocatedBalance(allocation: ProfitAllocation): Cents {
  return subtract(allocation.netProfit, allocatedTotal(allocation))
}

/**
 * "Percentual do lucro" — computed per item, per card subtotal and for the
 * unallocated balance (files_design/03). `null` when the profit is zero, so the
 * screen prints a dash instead of "0%" or "NaN%" (money.ts `percentOf`).
 */
export function percentOfProfit(allocation: ProfitAllocation, amount: Cents): number | null {
  return percentOf(amount, allocation.netProfit)
}

export function bucketPercent(
  allocation: ProfitAllocation,
  bucket: AllocationBucket,
): number | null {
  return percentOfProfit(allocation, bucketSubtotal(allocation, bucket))
}

export function unallocatedPercent(allocation: ProfitAllocation): number | null {
  return percentOfProfit(allocation, unallocatedBalance(allocation))
}

/**
 * The only rule that blocks "Salvar Destinação" (files_design/03: "soma dos
 * itens não pode exceder o lucro líquido"). A leftover deliberately does not
 * appear here — it is allowed, and `pendingItemFor` turns it into a Pendência.
 *
 * A loss blocks by arithmetic alone: any total, zero included, exceeds a
 * negative profit.
 */
export function canSave(allocation: ProfitAllocation): boolean {
  return allocatedTotal(allocation) <= allocation.netProfit
}

/** Whether one more item of `amount` still fits inside the profit. */
export function canAddItem(allocation: ProfitAllocation, amount: Cents): boolean {
  if (!canAllocate(allocation.netProfit)) return false
  if (amount < 0) return false
  return amount <= unallocatedBalance(allocation)
}

export function isDestinationValidForBucket(
  bucket: AllocationBucket,
  destination: AllocationDestination,
): boolean {
  return destination.kind === DESTINATION_KIND_BY_BUCKET[bucket]
}

/**
 * "+ Adicionar investimento/item/conta" — appends one item to one card and
 * returns a new allocation (files_design/01 §9).
 *
 * A negative amount is refused because the money mask can never produce one
 * (files_design/03, "campos monetários usam máscara ativa"): accepting it would
 * silently inflate the unallocated balance past the profit.
 */
export function addItem(
  allocation: ProfitAllocation,
  bucket: AllocationBucket,
  item: AllocationItem,
): ProfitAllocation {
  if (!canAllocate(allocation.netProfit)) {
    throw new Error('profit_allocation.no_profit_to_allocate')
  }
  if (item.amount < 0) {
    throw new Error('profit_allocation.negative_amount')
  }
  if (item.destination !== null && !isDestinationValidForBucket(bucket, item.destination)) {
    throw new Error('profit_allocation.destination_does_not_match_bucket')
  }
  if (!canAddItem(allocation, item.amount)) {
    throw new Error('profit_allocation.exceeds_net_profit')
  }
  return withItems(allocation, bucket, [...allocation.items[bucket], item])
}

/** "Remover" one item of a card, by its position in that card's list. */
export function removeItem(
  allocation: ProfitAllocation,
  bucket: AllocationBucket,
  index: number,
): ProfitAllocation {
  const items = allocation.items[bucket]
  if (!Number.isInteger(index) || index < 0 || index >= items.length) {
    throw new Error('profit_allocation.item_not_found')
  }
  return withItems(
    allocation,
    bucket,
    items.filter((_, position) => position !== index),
  )
}

/**
 * The Pendência the Home raises for whatever was not allocated
 * (files_design/01 §4, "Saldo não alocado da Destinação do Lucro"). `null` when
 * nothing is left over — and also when there is no profit to destine, because
 * a loss never reaches this screen.
 */
export function pendingItemFor(allocation: ProfitAllocation): UnallocatedProfitPendingItem | null {
  if (!canAllocate(allocation.netProfit)) return null
  const amount = unallocatedBalance(allocation)
  if (amount <= 0) return null
  return { kind: 'UnallocatedProfit', month: allocation.month, amount }
}

function withItems(
  allocation: ProfitAllocation,
  bucket: AllocationBucket,
  items: readonly AllocationItem[],
): ProfitAllocation {
  const next: Record<AllocationBucket, readonly AllocationItem[]> = { ...allocation.items }
  next[bucket] = items
  return { ...allocation, items: next }
}
