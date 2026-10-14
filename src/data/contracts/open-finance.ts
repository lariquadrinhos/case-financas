/**
 * Open Finance — the provider port and the three records the import keeps
 * (ADR-0020 §2).
 *
 * `OpenFinanceReader` is the only port in this folder that does not talk to
 * our database: it reads the bank, through the provider. It still takes
 * `userId` first (common.ts rule 1) — today the provider answers with the
 * application's own credentials, and phase 2 would give each person their own.
 * Its adapter is `src/data/pluggy/`; the type of the provider never crosses
 * this line.
 */

import type { BankAccountId, EntryId, IsoDate } from '@/domain/core'
import type {
  CardBill,
  ImportDecision,
  ImportedTransaction,
  OpenFinanceAccount,
  OpenFinanceLink,
  ProviderAccountId,
  ProviderTransactionId,
  TransferClassification,
  UnpaidCardPurchase,
} from '@/domain/open-finance'
import type { UserId } from './common'

export interface OpenFinanceReader {
  /** Every account of every connection this installation reads. */
  listAccounts(userId: UserId): Promise<readonly OpenFinanceAccount[]>
  /**
   * Posted transactions of one account from `from` on, plus the card's pending
   * purchases (marked `pending`): the bank posts them only when the bill closes.
   */
  listTransactions(
    userId: UserId,
    accountId: ProviderAccountId,
    from: IsoDate,
  ): Promise<readonly ImportedTransaction[]>
  /** The bills of a card account, to know which bill each payment pays (PRD §5). */
  listBills(userId: UserId, accountId: ProviderAccountId): Promise<readonly CardBill[]>
}

export interface OpenFinanceLinkReader {
  list(userId: UserId): Promise<readonly OpenFinanceLink[]>
}

export interface OpenFinanceLinkWriter {
  /** Creates or replaces the link of `link.providerAccountId`. */
  save(userId: UserId, link: OpenFinanceLink): Promise<OpenFinanceLink>
  remove(userId: UserId, providerAccountId: ProviderAccountId): Promise<void>
}

/**
 * The trace of one imported transaction. It is what makes the import
 * idempotent (the id is never imported twice), and it keeps the bank's
 * description as detail — the Lançamento itself has no field for it.
 */
export interface ImportedTransactionRecord {
  readonly transactionId: ProviderTransactionId
  readonly accountId: ProviderAccountId
  readonly date: IsoDate
  readonly amount: ImportedTransaction['amount']
  readonly description: string
  /** `TransferCounterpart` is the second half of a Transferência, recorded with it. */
  readonly outcome: ImportDecision['kind'] | 'TransferCounterpart'
  /** The Lançamento it created or paid. `null` once the person discards that Lançamento. */
  readonly entryId: EntryId | null
  /** For a card purchase: when the bill payment turned it into Pago. */
  readonly settledOn: IsoDate | null
  /** For a card purchase: the bill it belongs to, when the provider says. */
  readonly billId?: string | null
  /** For a card purchase: still in the open bill at the bank (2026-10-01). */
  readonly pending?: boolean
  /** The provider's category, as detail (PRD v7.46: it no longer picks a category). */
  readonly providerCategory?: string | null
  /** The person picked the category of this Lançamento; "Reimportar" keeps it. */
  readonly categorizedByPerson?: boolean
  /** Transferência: what it was (2026-09-29). `Unclassified` is a Pendência. */
  readonly transferKind?: 'Unclassified' | TransferClassification | null
  readonly counterpartTransactionId?: ProviderTransactionId | null
  readonly fromBankAccountId?: BankAccountId | null
  readonly toBankAccountId?: BankAccountId | null
}

export interface ImportedTransactionReader {
  listIds(userId: UserId): Promise<ReadonlySet<ProviderTransactionId>>
  /** Card purchases still Previsto, with the Lançamento still there. */
  listUnpaidCardPurchases(userId: UserId): Promise<readonly UnpaidCardPurchase[]>
  /** Every record — what "Reimportar" walks to undo the import. */
  listRecords(userId: UserId): Promise<readonly ImportedTransactionRecord[]>
}

export interface ImportedTransactionWriter {
  record(userId: UserId, record: ImportedTransactionRecord): Promise<void>
  markSettled(userId: UserId, entryIds: readonly EntryId[], on: IsoDate): Promise<void>
  /**
   * A pending card purchase as the bank reports it now — posted to its bill,
   * a new value, or a new id when the provider recreated it (2026-10-01). The
   * Lançamento link and `categorizedByPerson` stay: they are the person's.
   */
  followCardPurchase(
    userId: UserId,
    previousId: ProviderTransactionId,
    now: Pick<
      ImportedTransactionRecord,
      'transactionId' | 'date' | 'amount' | 'description' | 'billId' | 'providerCategory'
    > & { readonly pending: boolean },
  ): Promise<void>
  /** The person changed the category of this imported Lançamento. */
  markCategorizedByPerson(userId: UserId, entryId: EntryId): Promise<void>
  /** The person classified a Transferência between entities (and its Lançamento, if any). */
  classifyTransfer(
    userId: UserId,
    transactionId: ProviderTransactionId,
    classification: TransferClassification,
    entryId: EntryId | null,
  ): Promise<void>
  /**
   * "Vincular ao banco" (dono, 2026-10-09): the transaction becomes the bank
   * witness of a Lançamento the person made by hand, instead of the duplicate
   * it had created. Recorded as `PayPlanned` — the bank paid what the person
   * planned — and `categorizedByPerson`, so "Reimportar" keeps both.
   */
  relink(userId: UserId, transactionId: ProviderTransactionId, entryId: EntryId): Promise<void>
  /** Forgets these transactions, so the next sync imports them again. */
  removeRecords(userId: UserId, ids: readonly ProviderTransactionId[]): Promise<void>
}

export interface OpenFinanceSyncStateReader {
  /** ISO timestamp of the last successful sync, or `null` if there was none. */
  lastSyncedAt(userId: UserId): Promise<string | null>
  /** Whether the app syncs when it opens (2026-10-01). On until the person turns it off. */
  autoSyncEnabled(userId: UserId): Promise<boolean>
}

export interface OpenFinanceSyncStateWriter {
  markSynced(userId: UserId, at: string): Promise<void>
  setAutoSync(userId: UserId, enabled: boolean): Promise<void>
}
