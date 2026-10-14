/**
 * Destinação do Lucro — dividing the month's net profit between four buckets
 * (PRD UC6, files_design/01 §9).
 *
 * Deliberate exception to "entity as an attribute": this is a single
 * consolidated decision about the combined result, not a transaction of one
 * entity (files_design/02, "Princípios gerais").
 */

import type { BankAccountId, Cents, InvestmentId, Month } from '@/domain/core'

export const ALLOCATION_BUCKETS = [
  'InvestmentContribution',
  'DividendReinvestment',
  'ExtraordinaryConsumption',
  'CashReserve',
] as const
export type AllocationBucket = (typeof ALLOCATION_BUCKETS)[number]

export const LABEL_ALLOCATION_BUCKET: Record<AllocationBucket, string> = {
  InvestmentContribution: 'Aporte em Investimentos',
  DividendReinvestment: 'Reinvestimento de Dividendos',
  ExtraordinaryConsumption: 'Consumo Extraordinário',
  CashReserve: 'Reserva em Caixa',
}

/**
 * Where one item of a card points. The destination differs per bucket
 * (files_design/03 "Objeto Item de Destinação"): an investment in the two
 * investment cards, a bank account in Reserva em Caixa, and free text in
 * Consumo Extraordinário, which is a spend and has no destination record.
 */
export type AllocationDestination =
  | { readonly kind: 'Investment'; readonly investmentId: InvestmentId }
  | { readonly kind: 'BankAccount'; readonly bankAccountId: BankAccountId }
  | { readonly kind: 'FreeText'; readonly name: string }

/**
 * Which of the three destinations each card accepts (files_design/02, "Destinar
 * o Lucro ganhou campos de destino específico por balde"). The screen only ever
 * renders the matching field, so a mismatch means the caller built the item by
 * hand — `addItem` refuses it rather than storing an item no screen can show.
 */
export const DESTINATION_KIND_BY_BUCKET: Record<AllocationBucket, AllocationDestination['kind']> = {
  InvestmentContribution: 'Investment',
  DividendReinvestment: 'Investment',
  ExtraordinaryConsumption: 'FreeText',
  CashReserve: 'BankAccount',
}

/**
 * "Item de Destinação". Both fields are optional on the form — an incomplete
 * allocation is one of the three documented exceptions to "required by default"
 * (files_design/03, convenção geral) and surfaces as a Pendência on the Home.
 */
export interface AllocationItem {
  readonly destination: AllocationDestination | null
  readonly amount: Cents
}

export interface ProfitAllocation {
  readonly month: Month
  /** Read-only on the screen: the Lucro Líquido computed by the DRE for the month. */
  readonly netProfit: Cents
  /** Each card holds a list of items; every bucket is always present, possibly empty. */
  readonly items: Readonly<Record<AllocationBucket, readonly AllocationItem[]>>
}

/** An empty allocation has all four cards, each with no items (files_design/03). */
export const EMPTY_ALLOCATION_ITEMS: Readonly<Record<AllocationBucket, readonly AllocationItem[]>> =
  {
    InvestmentContribution: [],
    DividendReinvestment: [],
    ExtraordinaryConsumption: [],
    CashReserve: [],
  }

/**
 * The Pendência the Home shows while part of the profit was left over
 * ("Saldo não alocado da Destinação do Lucro", files_design/01 §4). Leaving the
 * allocation fields empty is what *creates* the Pendência, by design — it is
 * never a validation failure (files_design/02, "as 3 exceções").
 *
 * `kind` is here so the Home can discriminate it from the other Pendências of
 * the same banner list once they are modelled.
 */
export interface UnallocatedProfitPendingItem {
  readonly kind: 'UnallocatedProfit'
  readonly month: Month
  readonly amount: Cents
}
