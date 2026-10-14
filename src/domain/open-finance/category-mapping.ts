/**
 * What the provider's category still decides — and what it no longer does.
 *
 * PRD v7.46, decisão do dono de 2026-09-29: "deixa que eu categorizo, sem
 * de-para". The fixed table that mapped "Groceries" to Alimentação is gone:
 * it was the same for everyone and did not match how this person spends (a
 * PIX to one person is rent, a shop is a PJ cost). Every imported Lançamento
 * now lands in "A categorizar" (UNCATEGORIZED_*, chart-of-accounts/types.ts)
 * and the person picks the category in the DRE.
 *
 * The provider's category still answers three questions, because they decide
 * WHETHER a transaction enters the DRE, not where: is it the person's own
 * money moving, is it a refund, is it a card bill payment.
 */

import {
  UNCATEGORIZED_EXPENSE_CATEGORY_ID,
  UNCATEGORIZED_REVENUE_CATEGORY_ID,
} from '@/domain/chart-of-accounts'
import type { CategoryId } from '@/domain/core'

export function uncategorizedFor(direction: 'In' | 'Out'): CategoryId {
  return direction === 'Out' ? UNCATEGORIZED_EXPENSE_CATEGORY_ID : UNCATEGORIZED_REVENUE_CATEGORY_ID
}

/** Names the provider uses for a refund. Refunds have no destination yet (PRD P52). */
const REFUND_CATEGORIES = new Set(['refund', 'refunds', 'chargeback'])

/**
 * Spending categories of the provider. A CREDIT carrying one of them is money
 * coming back from a purchase — measured on the first real sync (2026-09-29):
 * credits categorised "Groceries", "Gas stations" and "Interests charged".
 */
const SPENDING_CATEGORIES = new Set([
  'groceries',
  'supermarket',
  'food and drinks',
  'eating out',
  'food delivery',
  'restaurants',
  'transportation',
  'taxi and ride-hailing',
  'public transportation',
  'gas stations',
  'parking',
  'tolls',
  'entertainment',
  'leisure',
  'gaming',
  'tickets',
  'travel',
  'clothing',
  'shopping',
  'online shopping',
  'streaming',
  'digital services',
  'pharmacy',
  'pet supplies and vet',
  'wellness and fitness',
  'gyms and fitness centers',
  'interests charged',
  'late payment and overdraft costs',
])

export function isRefund(providerCategory: string | null, description: string): boolean {
  if (providerCategory !== null) {
    const name = providerCategory.toLowerCase()
    if (REFUND_CATEGORIES.has(name) || SPENDING_CATEGORIES.has(name)) return true
  }
  return /\bestorno\b/i.test(description)
}

/**
 * The person's own money moving between two of their own places — an
 * automatic investment, a caixinha, a transfer to an account of the same
 * holder. Measured on the first real sync: "Automatic investment",
 * "Investments", "Fixed income", "Variable income", "Same person transfer" and
 * "Transfer - Internal" in both directions. A Transferência in spirit
 * (ADR-0017: moving value between positions is not DRE).
 *
 * "Transfer - PIX" and "Transfers" are NOT here: a PIX to someone else is money
 * that left the person.
 */
const OWN_MONEY_CATEGORIES = new Set([
  'automatic investment',
  'investments',
  'investment',
  'fixed income',
  'variable income',
  'same person transfer',
  'transfer - internal',
])

export function isOwnMoneyMovement(providerCategory: string | null): boolean {
  return providerCategory !== null && OWN_MONEY_CATEGORIES.has(providerCategory.toLowerCase())
}

/** A checking debit the provider calls a card bill payment, paired or not. */
export function isCardBillPayment(providerCategory: string | null): boolean {
  return providerCategory !== null && providerCategory.toLowerCase() === 'credit card payment'
}
