/**
 * Open Finance — the seam between the pure import rule and the ports
 * (ADR-0020 §2, §4, §6).
 *
 * A handler authorises, parses, delegates and serialises (ADR-0013 letra S);
 * reading the bank, reading what Bigorna holds, asking `planImport` what each
 * transaction becomes and writing that down is the delegation, and it lives
 * here so the sync route and the guards in the other routes read the SAME
 * links the same way.
 */

import { randomUUID } from 'node:crypto'

import {
  add,
  ZERO,
  addMonths,
  asId,
  compareMonths,
  monthOf,
  monthRange,
  type BankAccountId,
  type EntryId,
  type IsoDate,
  type Month,
  type TraceEventId,
} from '@/domain/core'
import { markAsPaid, type Entry, type NewEntry } from '@/domain/entries'
import {
  planImport,
  refusesManualPaid,
  transferNeedsClassification,
  type ImportDecision,
  type CardBill,
  type ImportedTransaction,
  type OpenFinanceSnapshot,
  type PlannedCandidate,
} from '@/domain/open-finance'
import {
  isOpen,
  occurrenceIdFor,
  occurrenceOfMonth,
  occurrencePaidWith,
  payOccurrence,
  type Occurrence,
  type Recurrence,
} from '@/domain/recurrence'
import { buildTraceEvent } from '@/domain/trace-events'
import { UNCATEGORIZED_CATEGORIES } from '@/domain/chart-of-accounts'
import type { Repositories } from '@/data'
import type { ImportedTransactionRecord, OpenFinanceReader } from '@/data/contracts/open-finance'
import type { UserId } from '@/data/contracts/common'
import { entrySubject } from './entry-subject'

/* -------------------------------------------------------------------------
 * Guards — what a person may no longer write by hand (ADR-0020 §3)
 * ---------------------------------------------------------------------- */

type LinkReader = Pick<Repositories, 'openFinanceLinkReader'>

export async function assertManualPaidAllowed(
  repos: LinkReader,
  userId: UserId,
  entry: Pick<NewEntry, 'kind' | 'status' | 'date'> & { bankAccountId?: BankAccountId },
): Promise<void> {
  const links = await repos.openFinanceLinkReader.list(userId)
  if (refusesManualPaid(entry, links)) throw new Error('open_finance.account_is_linked')
}

/** A linked position's balance comes from the bank; the person no longer edits it. */
export async function assertBalanceIsManual(
  repos: LinkReader,
  userId: UserId,
  target: { kind: 'BankAccount'; id: string } | { kind: 'Investment'; id: string },
): Promise<void> {
  const links = await repos.openFinanceLinkReader.list(userId)
  const linked = links.some((l) =>
    target.kind === 'BankAccount'
      ? l.target.kind === 'BankAccount' && l.target.bankAccountId === target.id
      : l.target.kind === 'Investment' && l.target.investmentId === target.id,
  )
  if (linked) throw new Error('open_finance.account_is_linked')
}

/* -------------------------------------------------------------------------
 * Sync
 * ---------------------------------------------------------------------- */

export interface SyncSummary {
  readonly balancesUpdated: number
  readonly imported: Readonly<Record<ImportDecision['kind'], number>>
}

function accountsOf(template: Recurrence['template'] | Entry | NewEntry): {
  bankAccountId: BankAccountId
  direction: 'In' | 'Out'
  counterpart: PlannedCandidate['counterpart']
} {
  switch (template.kind) {
    case 'Expense':
      return { bankAccountId: template.bankAccountId, direction: 'Out', counterpart: null }
    case 'Revenue':
      return { bankAccountId: template.bankAccountId, direction: 'In', counterpart: null }
    case 'IncomeTax':
      return {
        bankAccountId: template.bankAccountId,
        direction: template.direction === 'Payment' ? 'Out' : 'In',
        counterpart: null,
      }
    case 'ProLabore':
    case 'ProfitDistribution':
      return {
        bankAccountId: template.destinationAccountId,
        direction: 'In',
        counterpart:
          template.sourceAccountId === null
            ? null
            : { bankAccountId: template.sourceAccountId, direction: 'Out' },
      }
  }
}

/**
 * Every open occurrence of the months the import can reach — materialised or
 * still virtual (ADR-0004: a month materialises on its first visit, and the
 * bank does not wait for the person to open the Revisão de Recorrentes).
 */
async function openOccurrences(
  repos: Repositories,
  userId: UserId,
  months: readonly Month[],
): Promise<{ occurrence: Occurrence; recurrence: Recurrence }[]> {
  const recurrences = await repos.recurrenceReader.listOpen(userId)
  const found: { occurrence: Occurrence; recurrence: Recurrence }[] = []
  for (const month of months) {
    const stored = new Map(
      (await repos.occurrenceReader.listByMonth(userId, month)).map((o) => [o.id, o]),
    )
    for (const recurrence of recurrences) {
      const occurrence =
        stored.get(occurrenceIdFor(recurrence.id, month)) ?? occurrenceOfMonth(recurrence, month)
      if (occurrence !== null && isOpen(occurrence) && occurrence.plannedAmount !== null) {
        found.push({ occurrence, recurrence })
      }
    }
  }
  return found
}

/**
 * Step 1: read the bank. OUTSIDE any database transaction on purpose — a
 * `BEGIN IMMEDIATE` holds the write lock, and each provider call can take
 * seconds.
 */
export async function readBank(
  repos: Pick<Repositories, 'openFinanceLinkReader'>,
  provider: OpenFinanceReader,
  userId: UserId,
): Promise<OpenFinanceSnapshot> {
  const links = await repos.openFinanceLinkReader.list(userId)
  const accounts = await provider.listAccounts(userId)
  const transactions: ImportedTransaction[] = []
  const bills: CardBill[] = []
  for (const link of links) {
    if (link.target.kind === 'Investment') continue
    if (!accounts.some((a) => a.id === link.providerAccountId)) continue
    transactions.push(
      ...(await provider.listTransactions(userId, link.providerAccountId, link.linkedOn)),
    )
    if (link.target.kind === 'CreditCard') {
      bills.push(...(await provider.listBills(userId, link.providerAccountId)))
    }
  }
  return { accounts, transactions, bills }
}

/**
 * Step 2: write what `planImport` decided. The caller opens the transaction
 * (`withTransaction`), so a failure halfway leaves nothing behind — and the
 * next sync, finding none of these ids recorded, starts over.
 */
export async function applyBankSnapshot(
  repos: Repositories,
  snapshot: OpenFinanceSnapshot,
  userId: UserId,
  today: IsoDate,
): Promise<SyncSummary> {
  const links = await repos.openFinanceLinkReader.list(userId)
  const { accounts, transactions, bills } = snapshot

  const firstMonth = links.reduce<Month | null>((earliest, link) => {
    const m = monthOf(link.linkedOn)
    return earliest === null || compareMonths(m, earliest) < 0 ? m : earliest
  }, null)
  // One month ahead: a bill due on the 1st can post on the last day of the month before.
  const months = firstMonth === null ? [] : monthRange(firstMonth, addMonths(monthOf(today), 1))

  const unpaidCardPurchases = await repos.importedTransactionReader.listUnpaidCardPurchases(userId)
  const cardEntryIds = new Set<string>(unpaidCardPurchases.map((p) => p.entryId))
  const plannedEntries = (
    await repos.entryReader.search(userId, {
      status: 'Planned',
      view: null,
      month: null,
      categoryId: null,
      classification: null,
      bankAccountId: null,
      recurring: null,
    })
  ).items.filter((entry) => !cardEntryIds.has(entry.id))

  // Pago à mão numa conta vinculada (dono, 2026-10-09: "deixa eu marcar como
  // pago"): a transação do banco que o pagou casa com ele pela mesma regra do
  // Previsto (P49) — sem isto, ela entraria como um segundo lançamento e o
  // gasto contaria duas vezes. Fica de fora o que já está ligado a uma
  // transação: esse o banco já testemunhou.
  const linkedToBank = new Set(
    (await repos.importedTransactionReader.listRecords(userId)).flatMap((r) =>
      r.entryId === null ? [] : [r.entryId as string],
    ),
  )
  const manuallyPaid = (
    await repos.entryReader.search(userId, {
      status: 'Paid',
      view: null,
      month: null,
      categoryId: null,
      classification: null,
      bankAccountId: null,
      recurring: null,
    })
  ).items.filter((entry) => !linkedToBank.has(entry.id) && !cardEntryIds.has(entry.id))

  const occurrences = await openOccurrences(repos, userId, months)
  const occurrenceById = new Map(occurrences.map((o) => [o.occurrence.id, o]))

  const planned: PlannedCandidate[] = [
    ...[...plannedEntries, ...manuallyPaid].map((entry) => ({
      ref: { kind: 'Entry' as const, entryId: entry.id },
      amount: entry.amount,
      date: entry.date,
      ...accountsOf(entry),
    })),
    ...occurrences.map(({ occurrence, recurrence }) => ({
      ref: {
        kind: 'Occurrence' as const,
        occurrenceId: occurrence.id,
        recurrenceId: recurrence.id,
      },
      amount: occurrence.plannedAmount!,
      date: occurrence.plannedDate,
      ...accountsOf(recurrence.template),
    })),
  ]

  const bankAccounts = await repos.bankAccountReader.list(userId)
  // "A categorizar" is where every imported Lançamento lands (PRD v7.46). A
  // person who onboarded before it existed does not have it yet; the seed is
  // an idempotent upsert of just these two rows.
  await repos.categoryWriter.seed(userId, UNCATEGORIZED_CATEGORIES)
  const config = await repos.discretionarySpendingConfigReader.find(userId)

  const plan = planImport(
    { accounts, transactions, bills },
    {
      links,
      alreadyImported: await repos.importedTransactionReader.listIds(userId),
      discretionarySourceAccountId: config?.sourceAccountId ?? null,
      bankAccountEntities: new Map(bankAccounts.map((a) => [a.id, a.entity])),
      planned,
      unpaidCardPurchases,
      today,
    },
  )

  for (const update of plan.balances) {
    const target = update.target
    if (target.kind === 'BankAccount') {
      const account = bankAccounts.find((a) => a.id === target.bankAccountId)
      if (account !== undefined && account.balance !== update.balance) {
        await repos.bankAccountWriter.replace(userId, { ...account, balance: update.balance })
      }
    } else {
      const investment = await repos.investmentReader.findById(userId, target.investmentId)
      if (investment !== null && investment.accumulatedValue !== update.balance) {
        await repos.investmentWriter.replace(userId, {
          ...investment,
          accumulatedValue: update.balance,
        })
      }
    }
  }

  const imported: Record<ImportDecision['kind'], number> = {
    DiscretionaryExpense: 0,
    PayPlanned: 0,
    Transfer: 0,
    CardPurchase: 0,
    CardBillPayment: 0,
    Entry: 0,
    Ignored: 0,
  }
  const createdForTransaction = new Map<string, EntryId>()

  async function record(
    t: ImportedTransaction,
    outcome: ImportDecision['kind'] | 'TransferCounterpart',
    entryId: EntryId | null,
    extra: Partial<ImportedTransactionRecord> = {},
  ) {
    await repos.importedTransactionWriter.record(userId, {
      ...extra,
      transactionId: t.id,
      accountId: t.accountId,
      date: t.date,
      amount: t.amount,
      description: t.description,
      outcome,
      entryId,
      settledOn: null,
      billId: t.billId ?? null,
      pending: t.pending === true,
      providerCategory: t.providerCategory,
    })
  }

  async function payEntry(
    entryId: EntryId,
    date: IsoDate,
    amount?: Entry['amount'],
    description?: string,
  ) {
    const entry = await repos.entryReader.findById(userId, entryId)
    if (entry === null) return
    const paid = markAsPaid(entry, amount ?? entry.amount, date).entry
    // A descrição que a pessoa escreveu no Previsto vale mais que a do banco.
    await repos.entryWriter.replace(
      userId,
      entry.description || !description
        ? paid
        : { ...paid, description: description.slice(0, 200) },
    )
  }

  async function payOccurrenceWith(
    occurrenceId: Occurrence['id'],
    t: ImportedTransaction,
  ): Promise<EntryId> {
    const { occurrence, recurrence } = occurrenceById.get(occurrenceId)!
    // Get-or-create: a virtual occurrence materialises here (ADR-0004).
    const stored = await repos.occurrenceWriter.create(userId, occurrence)
    const { newEntry } = payOccurrence({
      recurrence,
      occurrence: stored,
      paidAmount: t.amount,
      paymentDate: t.date,
    })
    const entry = await repos.entryWriter.create(userId, {
      ...newEntry,
      description: t.description.trim().slice(0, 200) || null,
    })
    await repos.occurrenceWriter.replace(userId, occurrencePaidWith(stored, entry.id, t.amount))
    // Same Evento "Marcar Pago" writes for an exact payment (occurrences/[id]/payment).
    await repos.traceEventWriter.append(
      userId,
      buildTraceEvent(
        'RecurrencePaid',
        { kind: 'Recurrence', recurrenceId: recurrence.id },
        {
          id: asId<TraceEventId>(randomUUID()),
          date: t.date,
          subject: await entrySubject(entry, repos.categoryReader, userId),
        },
      ),
    )
    return entry.id
  }

  // Before the decisions: a purchase that posted in this batch may be settled
  // by its bill's payment below, and `payEntry` reads the entry as left here.
  for (const change of plan.cardPurchaseChanges) {
    if (change.kind === 'Vanished') {
      // A Previsto, so no report moves (PRD §5). The record goes too: if the
      // bank shows the purchase again, it is imported again.
      await repos.entryWriter.remove(userId, change.entryId)
      await repos.importedTransactionWriter.removeRecords(userId, [change.transactionId])
      continue
    }
    const t = change.transaction
    const entry = await repos.entryReader.findById(userId, change.entryId)
    if (entry !== null && entry.status === 'Planned') {
      await repos.entryWriter.replace(userId, {
        ...entry,
        amount: t.amount,
        date: change.entryDate,
      })
    }
    await repos.importedTransactionWriter.followCardPurchase(userId, change.previousTransactionId, {
      transactionId: t.id,
      date: t.date,
      amount: t.amount,
      description: t.description,
      billId: t.billId ?? null,
      providerCategory: t.providerCategory,
      pending: t.pending === true,
    })
  }

  const entityById = new Map(bankAccounts.map((a) => [a.id as string, a.entity]))
  const checkingTarget = (t: ImportedTransaction): BankAccountId | null => {
    const target = links.find((l) => l.providerAccountId === t.accountId)?.target
    return target?.kind === 'BankAccount' ? target.bankAccountId : null
  }

  // Bill payments last: they settle purchases this same batch creates.
  const ordered = [
    ...plan.decisions.filter((d) => d.kind !== 'CardBillPayment'),
    ...plan.decisions.filter((d) => d.kind === 'CardBillPayment'),
  ]

  for (const decision of ordered) {
    imported[decision.kind] += 1
    const t = decision.transaction
    switch (decision.kind) {
      case 'DiscretionaryExpense': {
        const expense = await repos.discretionaryExpenseWriter.create(userId, {
          date: t.date,
          amount: t.amount,
          // The Rótulo is where the widget shows detail, and detail is what the
          // person said to keep (ADR-0020 §4). Trimmed to the Rótulo's limit.
          label: t.description.trim().slice(0, 120) || null,
          // Measured on 2026-10-06: 12 of 12 imported Consumo Livre expenses
          // had the bank's text only in the Rótulo, and the Histórico, which
          // reads the Descrição, showed them blank. Same limit as entryFor.
          description: t.description.trim().slice(0, 200) || null,
        })
        await record(t, decision.kind, expense.id)
        break
      }
      case 'PayPlanned': {
        const ref = decision.ref
        if (ref.kind === 'Entry') {
          await payEntry(ref.entryId, t.date, t.amount, t.description.trim())
          await record(t, decision.kind, ref.entryId)
        } else {
          await record(t, decision.kind, await payOccurrenceWith(ref.occurrenceId, t))
        }
        break
      }
      case 'Transfer': {
        // Entre entidades é Pendência (2026-09-29): a pessoa diz se foi
        // pró-labore, distribuição, aporte ou só transferência. Na mesma
        // entidade, é Transferência e pronto.
        const from = checkingTarget(t)
        const to = checkingTarget(decision.counterpart)
        const fromEntity = from === null ? null : entityById.get(from)
        const toEntity = to === null ? null : entityById.get(to)
        const needs =
          fromEntity !== undefined &&
          fromEntity !== null &&
          toEntity !== undefined &&
          toEntity !== null &&
          transferNeedsClassification(fromEntity, toEntity)
        await record(t, decision.kind, null, {
          transferKind: needs ? 'Unclassified' : 'Transfer',
          counterpartTransactionId: decision.counterpart.id,
          fromBankAccountId: from,
          toBankAccountId: to,
        })
        await record(decision.counterpart, 'TransferCounterpart', null)
        break
      }
      case 'CardPurchase':
      case 'Entry': {
        const entry = await repos.entryWriter.create(userId, decision.entry)
        createdForTransaction.set(t.id, entry.id)
        await record(t, decision.kind, entry.id)
        break
      }
      case 'CardBillPayment': {
        const settled = [
          ...decision.settles,
          ...decision.settlesInBatch.flatMap((id) => {
            const entryId = createdForTransaction.get(id)
            return entryId === undefined ? [] : [entryId]
          }),
        ]
        for (const entryId of settled) await payEntry(entryId, t.date)
        await repos.importedTransactionWriter.markSettled(userId, settled, t.date)
        await record(t, decision.kind, null)
        break
      }
      case 'Ignored':
        await record(t, decision.kind, null)
        break
    }
  }

  await repos.openFinanceSyncStateWriter.markSynced(userId, new Date().toISOString())
  return { balancesUpdated: plan.balances.length, imported }
}

/**
 * The balance of ONE position, recomputed from the provider accounts still
 * linked to it — right after a link or an unlink, instead of waiting for the
 * next sync (owner's request, 2026-09-29: unlinking one of two accounts summed
 * into a Conta Bancária left its share in the balance until the next sync).
 *
 * When the last link goes, the position keeps the last balance the bank gave
 * and becomes manual again: zeroing it would make that money vanish from the
 * Balanço while it is still in the bank.
 */
export async function refreshLinkedBalance(
  repos: Repositories,
  accounts: readonly OpenFinanceSnapshot['accounts'][number][],
  userId: UserId,
  target:
    | { kind: 'BankAccount'; bankAccountId: BankAccountId }
    | { kind: 'Investment'; investmentId: string },
): Promise<void> {
  const links = await repos.openFinanceLinkReader.list(userId)
  const feeding = links.filter((l) =>
    target.kind === 'BankAccount'
      ? l.target.kind === 'BankAccount' && l.target.bankAccountId === target.bankAccountId
      : l.target.kind === 'Investment' && l.target.investmentId === target.investmentId,
  )
  if (feeding.length === 0) return
  const ids = new Set<string>(feeding.map((l) => l.providerAccountId))
  const balance = add(ZERO, ...accounts.filter((a) => ids.has(a.id)).map((a) => a.balance))

  if (target.kind === 'BankAccount') {
    const account = await repos.bankAccountReader.findById(userId, target.bankAccountId)
    if (account !== null && account.balance !== balance) {
      await repos.bankAccountWriter.replace(userId, { ...account, balance })
    }
    return
  }
  const investment = await repos.investmentReader.findById(userId, target.investmentId as never)
  if (investment !== null && investment.accumulatedValue !== balance) {
    await repos.investmentWriter.replace(userId, { ...investment, accumulatedValue: balance })
  }
}

/**
 * "Reimportar": undoes what the import CREATED and forgets those
 * transactions, so the next `applyBankSnapshot` imports them again with the
 * rules and the configuration of now (owner's request, 2026-09-29 — the first
 * real import ran before the Consumo Livre was configured and before the card
 * rule knew about bills, and the import is otherwise permanent).
 *
 * What it undoes: the Lançamentos it created (avulsos, card purchases,
 * Consumo Livre expenses) and the records of transfers, bill payments and
 * ignored transactions. What it KEEPS: a Previsto the bank paid
 * (`PayPlanned`) — undoing it would need the planned date the payment
 * overwrote, which is gone — and a Lançamento whose category the person
 * picked (`categorizedByPerson`, PRD v7.46).
 */
export async function undoImport(repos: Repositories, userId: UserId): Promise<number> {
  const records = await repos.importedTransactionReader.listRecords(userId)
  // Kept: a Previsto the bank paid (see above) and a Lançamento whose category
  // the person picked — redoing it would put it back in "A categorizar".
  const undone = records.filter((r) => r.outcome !== 'PayPlanned' && !r.categorizedByPerson)
  for (const record of undone) {
    if (record.entryId === null) continue
    if (record.outcome === 'DiscretionaryExpense') {
      await repos.discretionaryExpenseWriter.remove(userId, record.entryId)
    } else if (record.outcome === 'Entry' || record.outcome === 'CardPurchase') {
      await repos.entryWriter.remove(userId, record.entryId)
    }
  }
  await repos.importedTransactionWriter.removeRecords(
    userId,
    undone.map((r) => r.transactionId),
  )
  return undone.length
}
