/**
 * Open Finance — what the bank says happened, before it becomes a Lançamento
 * (ADR-0020, Event Storming Fluxo N).
 *
 * The domain never says "Pluggy": this is the product concept, and the
 * provider lives behind `OpenFinanceReader` (src/data/contracts/open-finance.ts).
 * Nothing here carries a CPF, a CNPJ or the account holder's name — the entity
 * comes from the position the account is linked to, not from the bank
 * (ADR-0020 §3, minimização).
 */

import type {
  BankAccountId,
  Cents,
  EntryId,
  InvestmentId,
  IsoDate,
  OccurrenceId,
  RecurrenceId,
} from '@/domain/core'
import type { NewEntry } from '@/domain/entries'

/** The provider's own id for an account. Opaque: never logged (ADR-0020 §7). */
export type ProviderAccountId = string & { readonly __brand: 'ProviderAccountId' }
/** The provider's own id for a transaction — the idempotency key (ADR-0020 §2). */
export type ProviderTransactionId = string & { readonly __brand: 'ProviderTransactionId' }

export const OPEN_FINANCE_ACCOUNT_KINDS = ['Checking', 'CreditCard', 'Investment'] as const
export type OpenFinanceAccountKind = (typeof OPEN_FINANCE_ACCOUNT_KINDS)[number]

/**
 * One account as the bank reports it. `balance` is what the bank says the
 * position holds today: for a card, the amount of the open bill.
 */
export interface OpenFinanceAccount {
  readonly id: ProviderAccountId
  readonly kind: OpenFinanceAccountKind
  /** The bank's product name ("Conta Corrente"), shown only in the link dropdown. */
  readonly name: string
  /** Last digits only — enough to tell two accounts apart, nothing to identify a person. */
  readonly numberSuffix: string | null
  /** The bank of the connection ("Itaú"), for grouping on screen. `null` when unknown. */
  readonly institution: string | null
  readonly balance: Cents
}

/**
 * `amount` is always positive and `direction` carries the sign, so no rule
 * downstream has to remember that a card purchase is positive at the provider
 * and a checking debit is negative (docs.pluggy.ai, "Transactions").
 */
export interface ImportedTransaction {
  readonly id: ProviderTransactionId
  readonly accountId: ProviderAccountId
  /** The date the bank posted it: the payment date the cash basis asks for (ADR-0001 §2). */
  readonly date: IsoDate
  readonly amount: Cents
  readonly direction: 'In' | 'Out'
  /** The bank's text. Kept as detail, never logged, never a category. */
  readonly description: string
  /** The provider's category name, or `null` when the plan does not include one. */
  readonly providerCategory: string | null
  /** Card only: the bill this purchase belongs to. Absent when the provider does not say. */
  readonly billId?: string | null
  /**
   * Card only: the bank still holds it in the open bill (PRD §5 — it is a
   * Previsto either way). Its value may still change, or it may vanish, until
   * the bill closes; `reconcilePendingCardPurchases` follows it.
   */
  readonly pending?: boolean
}

/** One bill of a card, as the provider reports it. */
export interface CardBill {
  readonly id: string
  readonly accountId: ProviderAccountId
  /** Cash basis (PRD §5): a card purchase is paid in the month its bill is due. */
  readonly dueDate: IsoDate
  /** The day the bill closed — what `cardImportStart` reads. Absent when the provider does not say. */
  readonly closingDate?: IsoDate
}

export interface OpenFinanceSnapshot {
  readonly accounts: readonly OpenFinanceAccount[]
  readonly transactions: readonly ImportedTransaction[]
  /** Absent or empty when the provider reports no bills: the FIFO fallback applies. */
  readonly bills?: readonly CardBill[]
}

/** Where a provider account points in Bigorna (ADR-0020 §3). */
export type OpenFinanceLinkTarget =
  | { readonly kind: 'BankAccount'; readonly bankAccountId: BankAccountId }
  /** A card is not a position of its own: its purchases are paid by this account. */
  | { readonly kind: 'CreditCard'; readonly paidByBankAccountId: BankAccountId }
  | { readonly kind: 'Investment'; readonly investmentId: InvestmentId }

export interface OpenFinanceLink {
  readonly providerAccountId: ProviderAccountId
  readonly target: OpenFinanceLinkTarget
  /**
   * From this date on the bank is the witness of the fact: transactions before
   * it are not imported, and a manual Pago on the account is refused after it.
   */
  readonly linkedOn: IsoDate
}

/**
 * Something the person planned that a transaction may turn into Pago:
 * a Previsto Lançamento, or an open occurrence of a recurrence.
 */
export type PlannedRef =
  | { readonly kind: 'Entry'; readonly entryId: EntryId }
  | {
      readonly kind: 'Occurrence'
      readonly occurrenceId: OccurrenceId
      readonly recurrenceId: RecurrenceId
    }

export interface PlannedCandidate {
  readonly ref: PlannedRef
  readonly bankAccountId: BankAccountId
  readonly direction: 'In' | 'Out'
  readonly amount: Cents
  readonly date: IsoDate
  /**
   * Pró-labore and distribuição move money out of the PJ and into the PF: the
   * one plan is paid by two transactions, and the PJ side must not be imported
   * a second time as an expense.
   */
  readonly counterpart: { readonly bankAccountId: BankAccountId; readonly direction: 'Out' } | null
}

/** A card purchase imported earlier and still Previsto, waiting for its bill. */
export interface UnpaidCardPurchase {
  readonly entryId: EntryId
  readonly cardAccountId: ProviderAccountId
  /** The purchase date, as the bank reported it. */
  readonly date: IsoDate
  /** The Lançamento's date now — the bill's due date it was put on (PRD §5). */
  readonly entryDate?: IsoDate
  readonly amount: Cents
  readonly billId?: string | null
  /** The provider's id — what the next sync looks for to follow a pending purchase. */
  readonly transactionId?: ProviderTransactionId
  /** Imported while the bank still held it in the open bill (ImportedTransaction.pending). */
  readonly pending?: boolean
}

/**
 * What became of a card purchase imported while PENDING (2026-10-01). The
 * Lançamento is kept, with the category the person may have picked, and
 * follows what the bank says now.
 */
export type CardPurchaseChange =
  | {
      /**
       * Same purchase, new facts: posted to its bill, a new value, or a new id
       * when the provider deleted and recreated it (`previousTransactionId`
       * differs from `transaction.id`).
       */
      readonly kind: 'Updated'
      readonly entryId: EntryId
      readonly previousTransactionId: ProviderTransactionId
      readonly transaction: ImportedTransaction
      /** Cash basis (PRD §5): the bill's due date once known, else the purchase date. */
      readonly entryDate: IsoDate
    }
  | {
      /** Gone from the bank with nothing to replace it — a cancelled pre-authorisation. */
      readonly kind: 'Vanished'
      readonly entryId: EntryId
      readonly transactionId: ProviderTransactionId
    }

export interface ImportState {
  readonly links: readonly OpenFinanceLink[]
  readonly alreadyImported: ReadonlySet<ProviderTransactionId>
  /** The Consumo Livre's "conta de origem", or `null` when the widget is not configured. */
  readonly discretionarySourceAccountId: BankAccountId | null
  readonly bankAccountEntities: ReadonlyMap<BankAccountId, 'PF' | 'PJ'>
  readonly planned: readonly PlannedCandidate[]
  readonly unpaidCardPurchases: readonly UnpaidCardPurchase[]
  /**
   * The sync's date. A pending card purchase older than the provider's window
   * of recent transactions is not deleted when it goes missing (rules.ts,
   * phase 0b). Without it, every missing pending purchase is deleted.
   */
  readonly today?: IsoDate
}

export type IgnoredReason =
  /** Posted before the link date. */
  | 'BeforeLink'
  /** The provider account is not linked to anything. */
  | 'Unlinked'
  /** The PJ side of a pró-labore or distribuição already paid through its PF side. */
  | 'IntercompanyCounterpart'
  /** The card side of a bill payment: the checking side already settled it. */
  | 'CardBillCredit'
  /** A credit on the card that is not a bill payment (estorno). No rule yet (PRD P52). */
  | 'CardCredit'
  /** A refund on the checking account. No rule yet (PRD P52). */
  | 'Refund'
  /** Transactions on an investment account: only the balance is read (ADR-0020 §4). */
  | 'InvestmentMovement'
  /** Between two provider accounts joined into the same Conta Bancária. */
  | 'InternalMovement'
  /** Own money between the person's own places: investments, same-holder transfers (ADR-0017). */
  | 'OwnMoneyMovement'

export type ImportDecision =
  | {
      readonly kind: 'DiscretionaryExpense'
      readonly transaction: ImportedTransaction
    }
  | {
      readonly kind: 'PayPlanned'
      readonly transaction: ImportedTransaction
      readonly ref: PlannedRef
    }
  | {
      /** Money between two linked accounts. No Lançamento: the bank balances already moved. */
      readonly kind: 'Transfer'
      readonly transaction: ImportedTransaction
      readonly counterpart: ImportedTransaction
    }
  | {
      readonly kind: 'CardPurchase'
      readonly transaction: ImportedTransaction
      readonly entry: NewEntry
    }
  | {
      readonly kind: 'CardBillPayment'
      readonly transaction: ImportedTransaction
      /** Card purchases imported in earlier syncs that this payment turns into Pago. */
      readonly settles: readonly EntryId[]
      /** Card purchases imported in THIS sync, which have no EntryId yet. */
      readonly settlesInBatch: readonly ProviderTransactionId[]
    }
  | {
      /** An unmatched transaction on a linked account that is not the Consumo Livre's. */
      readonly kind: 'Entry'
      readonly transaction: ImportedTransaction
      readonly entry: NewEntry
    }
  | {
      readonly kind: 'Ignored'
      readonly transaction: ImportedTransaction
      readonly reason: IgnoredReason
    }

export interface BalanceUpdate {
  readonly target: Exclude<OpenFinanceLinkTarget, { kind: 'CreditCard' }>
  readonly balance: Cents
}

export interface ImportPlan {
  readonly balances: readonly BalanceUpdate[]
  readonly decisions: readonly ImportDecision[]
  readonly cardPurchaseChanges: readonly CardPurchaseChange[]
}
