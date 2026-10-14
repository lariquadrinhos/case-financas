/**
 * Pluggy payload → domain types. Pure, so the provider's quirks are tested
 * without a network.
 *
 * Shapes follow docs.pluggy.ai (Accounts, Transactions, Investments). Only the
 * fields Bigorna uses are declared; the payload carries more — `owner`,
 * `taxNumber`, `paymentData` with the payer's name — and they are dropped here
 * so they never reach the domain (ADR-0020 §3, minimização).
 */

import { fromReais, isoDate } from '@/domain/core'
import type {
  CardBill,
  ImportedTransaction,
  OpenFinanceAccount,
  OpenFinanceAccountKind,
  ProviderAccountId,
  ProviderTransactionId,
} from '@/domain/open-finance'

export interface PluggyAccount {
  readonly id: string
  readonly type: string
  readonly subtype?: string
  readonly number?: string | null
  readonly name: string
  readonly marketingName?: string | null
  readonly balance: number
  readonly currencyCode?: string
  readonly [other: string]: unknown
}

export interface PluggyTransaction {
  readonly id: string
  readonly description: string
  readonly amount: number
  readonly amountInAccountCurrency?: number | null
  readonly date: string
  readonly category?: string | null
  readonly status: string
  readonly type?: string
  readonly currencyCode?: string
  readonly creditCardMetadata?: { readonly billId?: string | null } | null
  readonly [other: string]: unknown
}

export interface PluggyBill {
  readonly id: string
  readonly dueDate: string
  readonly billClosingDate?: string | null
  readonly [other: string]: unknown
}

export interface PluggyInvestment {
  readonly id: string
  readonly name: string
  readonly balance: number
  readonly number?: string | null
  readonly [other: string]: unknown
}

function suffixOf(number: string | null | undefined): string | null {
  if (!number) return null
  const digits = number.replace(/\D/g, '')
  return digits.length === 0 ? null : digits.slice(-4)
}

export function normalizeAccount(
  account: PluggyAccount,
  institution: string | null = null,
): OpenFinanceAccount {
  return {
    id: account.id as ProviderAccountId,
    kind: account.type === 'CREDIT' ? 'CreditCard' : 'Checking',
    name: account.marketingName || account.name,
    numberSuffix: suffixOf(account.number),
    institution,
    balance: fromReais(account.balance),
  }
}

export function normalizeInvestment(
  investment: PluggyInvestment,
  institution: string | null = null,
): OpenFinanceAccount {
  return {
    id: investment.id as ProviderAccountId,
    kind: 'Investment',
    name: investment.name,
    numberSuffix: suffixOf(investment.number),
    institution,
    balance: fromReais(investment.balance),
  }
}

/**
 * `null` for what must not be imported yet: a PENDING transaction on a
 * checking account can still change value or disappear, and importing it as
 * Pago would write a fact that was not one.
 *
 * A PENDING card purchase is kept, marked `pending`. Measured on 2026-10-01:
 * the bank holds every purchase of the open bill as PENDING, without a
 * `billId`, until the bill closes — dropping them kept a purchase out of
 * Bigorna for up to a month. It becomes a Previsto, which no report reads
 * (PRD §5), so a value that still changes moves no number on screen.
 *
 * The sign convention differs per account (docs.pluggy.ai, "Transactions"):
 * on a checking account a negative amount is money out; on a credit card a
 * positive amount is a purchase (money out) and a negative one a payment or a
 * refund (money in).
 */
export function normalizeTransaction(
  transaction: PluggyTransaction,
  account: { readonly id: string; readonly kind: OpenFinanceAccountKind },
): ImportedTransaction | null {
  const pending = transaction.status === 'PENDING' && account.kind === 'CreditCard'
  if (transaction.status !== 'POSTED' && !pending) return null

  const raw =
    transaction.currencyCode !== undefined &&
    transaction.currencyCode !== 'BRL' &&
    typeof transaction.amountInAccountCurrency === 'number'
      ? transaction.amountInAccountCurrency
      : transaction.amount
  const outgoing = account.kind === 'CreditCard' ? raw > 0 : raw < 0

  return {
    id: transaction.id as ProviderTransactionId,
    accountId: account.id as ProviderAccountId,
    // The provider sends the posted DAY at 00:00Z. Slicing keeps that day;
    // `new Date()` in UTC-3 would move a transaction of the 1st to the
    // previous month (CLAUDE.md §6, "Datas").
    date: isoDate(transaction.date.slice(0, 10)),
    amount: fromReais(Math.abs(raw)),
    direction: outgoing ? 'Out' : 'In',
    description: transaction.description,
    providerCategory: transaction.category ?? null,
    billId: transaction.creditCardMetadata?.billId ?? null,
    pending,
  }
}

export function normalizeBill(bill: PluggyBill, accountId: string): CardBill {
  return {
    id: bill.id,
    accountId: accountId as ProviderAccountId,
    // Same slicing as the transaction date: the provider sends the day at 00:00Z.
    dueDate: isoDate(bill.dueDate.slice(0, 10)),
    ...(typeof bill.billClosingDate === 'string'
      ? { closingDate: isoDate(bill.billClosingDate.slice(0, 10)) }
      : {}),
  }
}
