/**
 * Open Finance — the SQLite adapter for the three records the import keeps
 * (src/data/contracts/open-finance.ts, ADR-0020).
 *
 * The provider itself is NOT here: it is a different port with a different
 * adapter (`src/data/pluggy/`), because reading the bank and remembering what
 * was read change for unrelated reasons.
 */

import { and, eq, isNull } from 'drizzle-orm'

import {
  asId,
  cents,
  isoDate,
  type BankAccountId,
  type EntryId,
  type InvestmentId,
  type IsoDate,
} from '@/domain/core'
import type {
  OpenFinanceLink,
  OpenFinanceLinkTarget,
  ProviderAccountId,
  ProviderTransactionId,
  TransferClassification,
} from '@/domain/open-finance'
import type { UserId } from '@/data/contracts/common'
import type {
  ImportedTransactionReader,
  ImportedTransactionRecord,
  ImportedTransactionWriter,
  OpenFinanceLinkReader,
  OpenFinanceLinkWriter,
  OpenFinanceSyncStateReader,
  OpenFinanceSyncStateWriter,
} from '@/data/contracts/open-finance'
import type { BigornaDatabase } from './client'
import {
  entries,
  importedTransactions,
  openFinanceLinks,
  openFinanceSettings,
  openFinanceSyncState,
} from './schema'

type LinkRow = typeof openFinanceLinks.$inferSelect

function toTarget(row: LinkRow): OpenFinanceLinkTarget {
  if (row.targetKind === 'Investment') {
    return { kind: 'Investment', investmentId: asId<InvestmentId>(row.targetInvestmentId!) }
  }
  const bankAccountId = asId<BankAccountId>(row.targetBankAccountId!)
  return row.targetKind === 'CreditCard'
    ? { kind: 'CreditCard', paidByBankAccountId: bankAccountId }
    : { kind: 'BankAccount', bankAccountId }
}

function targetColumns(target: OpenFinanceLinkTarget) {
  switch (target.kind) {
    case 'BankAccount':
      return { targetBankAccountId: target.bankAccountId, targetInvestmentId: null }
    case 'CreditCard':
      return { targetBankAccountId: target.paidByBankAccountId, targetInvestmentId: null }
    case 'Investment':
      return { targetBankAccountId: null, targetInvestmentId: target.investmentId }
  }
}

export function createOpenFinanceRepositories(db: BigornaDatabase): {
  links: { reader: OpenFinanceLinkReader; writer: OpenFinanceLinkWriter }
  imported: { reader: ImportedTransactionReader; writer: ImportedTransactionWriter }
  syncState: { reader: OpenFinanceSyncStateReader; writer: OpenFinanceSyncStateWriter }
} {
  const links = {
    reader: {
      async list(userId: UserId) {
        const rows = db
          .select()
          .from(openFinanceLinks)
          .where(eq(openFinanceLinks.userId, userId))
          .all()
        return rows.map((row): OpenFinanceLink => ({
          providerAccountId: row.providerAccountId as ProviderAccountId,
          target: toTarget(row),
          linkedOn: isoDate(row.linkedOn),
        }))
      },
    } satisfies OpenFinanceLinkReader,
    writer: {
      async save(userId: UserId, link: OpenFinanceLink) {
        const values = {
          targetKind: link.target.kind,
          ...targetColumns(link.target),
          linkedOn: link.linkedOn,
        }
        db.insert(openFinanceLinks)
          .values({ userId, providerAccountId: link.providerAccountId, ...values })
          .onConflictDoUpdate({
            target: [openFinanceLinks.userId, openFinanceLinks.providerAccountId],
            set: values,
          })
          .run()
        return link
      },
      async remove(userId: UserId, providerAccountId: ProviderAccountId) {
        db.delete(openFinanceLinks)
          .where(
            and(
              eq(openFinanceLinks.userId, userId),
              eq(openFinanceLinks.providerAccountId, providerAccountId),
            ),
          )
          .run()
      },
    } satisfies OpenFinanceLinkWriter,
  }

  const imported = {
    reader: {
      async listIds(userId: UserId) {
        const rows = db
          .select({ id: importedTransactions.transactionId })
          .from(importedTransactions)
          .where(eq(importedTransactions.userId, userId))
          .all()
        return new Set(rows.map((row) => row.id as ProviderTransactionId))
      },
      async listUnpaidCardPurchases(userId: UserId) {
        // The inner join is what drops a purchase whose Lançamento the person
        // discarded — see the comment on `imported_transactions.entry_id`.
        const rows = db
          .select({
            entryId: importedTransactions.entryId,
            transactionId: importedTransactions.transactionId,
            accountId: importedTransactions.accountId,
            date: importedTransactions.date,
            entryDate: entries.date,
            amount: importedTransactions.amount,
            billId: importedTransactions.billId,
            pending: importedTransactions.pending,
          })
          .from(importedTransactions)
          .innerJoin(
            entries,
            and(
              eq(entries.userId, importedTransactions.userId),
              eq(entries.id, importedTransactions.entryId),
            ),
          )
          .where(
            and(
              eq(importedTransactions.userId, userId),
              eq(importedTransactions.outcome, 'CardPurchase'),
              isNull(importedTransactions.settledOn),
              eq(entries.status, 'Planned'),
            ),
          )
          .all()
        return rows.map((row) => ({
          entryId: asId<EntryId>(row.entryId!),
          transactionId: row.transactionId as ProviderTransactionId,
          cardAccountId: row.accountId as ProviderAccountId,
          date: isoDate(row.date),
          entryDate: isoDate(row.entryDate),
          amount: cents(row.amount),
          billId: row.billId,
          pending: row.pending,
        }))
      },
      async listRecords(userId: UserId) {
        const rows = db
          .select()
          .from(importedTransactions)
          .where(eq(importedTransactions.userId, userId))
          .all()
        return rows.map((row): ImportedTransactionRecord => ({
          transactionId: row.transactionId as ProviderTransactionId,
          accountId: row.accountId as ProviderAccountId,
          date: isoDate(row.date),
          amount: cents(row.amount),
          description: row.description,
          outcome: row.outcome,
          entryId: row.entryId === null ? null : asId<EntryId>(row.entryId),
          settledOn: row.settledOn === null ? null : isoDate(row.settledOn),
          billId: row.billId,
          pending: row.pending,
          providerCategory: row.providerCategory,
          categorizedByPerson: row.categorizedByPerson,
          transferKind: row.transferKind,
          counterpartTransactionId: row.counterpartTransactionId as ProviderTransactionId | null,
          fromBankAccountId:
            row.fromBankAccountId === null ? null : asId<BankAccountId>(row.fromBankAccountId),
          toBankAccountId:
            row.toBankAccountId === null ? null : asId<BankAccountId>(row.toBankAccountId),
        }))
      },
    } satisfies ImportedTransactionReader,
    writer: {
      async record(userId: UserId, record: ImportedTransactionRecord) {
        db.insert(importedTransactions)
          .values({
            userId,
            ...record,
            billId: record.billId ?? null,
            pending: record.pending ?? false,
            providerCategory: record.providerCategory ?? null,
            categorizedByPerson: record.categorizedByPerson ?? false,
            transferKind: record.transferKind ?? null,
            counterpartTransactionId: record.counterpartTransactionId ?? null,
            fromBankAccountId: record.fromBankAccountId ?? null,
            toBankAccountId: record.toBankAccountId ?? null,
          })
          .run()
      },
      async markSettled(userId: UserId, entryIds: readonly EntryId[], on: IsoDate) {
        for (const entryId of entryIds) {
          db.update(importedTransactions)
            .set({ settledOn: on })
            .where(
              and(
                eq(importedTransactions.userId, userId),
                eq(importedTransactions.entryId, entryId),
              ),
            )
            .run()
        }
      },
      async followCardPurchase(userId, previousId, now) {
        db.update(importedTransactions)
          .set({
            transactionId: now.transactionId,
            date: now.date,
            amount: now.amount,
            description: now.description,
            billId: now.billId ?? null,
            providerCategory: now.providerCategory ?? null,
            pending: now.pending,
          })
          .where(
            and(
              eq(importedTransactions.userId, userId),
              eq(importedTransactions.transactionId, previousId),
            ),
          )
          .run()
      },
      async relink(userId: UserId, transactionId: ProviderTransactionId, entryId: EntryId) {
        db.update(importedTransactions)
          .set({ entryId, outcome: 'PayPlanned', categorizedByPerson: true })
          .where(
            and(
              eq(importedTransactions.userId, userId),
              eq(importedTransactions.transactionId, transactionId),
            ),
          )
          .run()
      },
      async markCategorizedByPerson(userId: UserId, entryId: EntryId) {
        db.update(importedTransactions)
          .set({ categorizedByPerson: true })
          .where(
            and(eq(importedTransactions.userId, userId), eq(importedTransactions.entryId, entryId)),
          )
          .run()
      },
      async classifyTransfer(
        userId: UserId,
        transactionId: ProviderTransactionId,
        classification: TransferClassification,
        entryId: EntryId | null,
      ) {
        // `categorizedByPerson` too: a choice the person made is kept by "Reimportar".
        db.update(importedTransactions)
          .set({ transferKind: classification, entryId, categorizedByPerson: true })
          .where(
            and(
              eq(importedTransactions.userId, userId),
              eq(importedTransactions.transactionId, transactionId),
            ),
          )
          .run()
      },
      async removeRecords(userId: UserId, ids: readonly ProviderTransactionId[]) {
        for (const id of ids) {
          db.delete(importedTransactions)
            .where(
              and(
                eq(importedTransactions.userId, userId),
                eq(importedTransactions.transactionId, id),
              ),
            )
            .run()
        }
      },
    } satisfies ImportedTransactionWriter,
  }

  const syncState = {
    reader: {
      async lastSyncedAt(userId: UserId) {
        const row = db
          .select()
          .from(openFinanceSyncState)
          .where(eq(openFinanceSyncState.userId, userId))
          .get()
        return row?.lastSyncedAt ?? null
      },
      async autoSyncEnabled(userId: UserId) {
        const row = db
          .select()
          .from(openFinanceSettings)
          .where(eq(openFinanceSettings.userId, userId))
          .get()
        return row?.autoSync ?? true
      },
    } satisfies OpenFinanceSyncStateReader,
    writer: {
      async markSynced(userId: UserId, at: string) {
        db.insert(openFinanceSyncState)
          .values({ userId, lastSyncedAt: at })
          .onConflictDoUpdate({ target: openFinanceSyncState.userId, set: { lastSyncedAt: at } })
          .run()
      },
      async setAutoSync(userId: UserId, enabled: boolean) {
        db.insert(openFinanceSettings)
          .values({ userId, autoSync: enabled })
          .onConflictDoUpdate({ target: openFinanceSettings.userId, set: { autoSync: enabled } })
          .run()
      },
    } satisfies OpenFinanceSyncStateWriter,
  }

  return { links, imported, syncState }
}
