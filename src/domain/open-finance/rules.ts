/**
 * What each imported transaction becomes (ADR-0020 §4, Event Storming Fluxo N).
 *
 * Pure: it receives what the bank said and what Bigorna already holds, and
 * returns decisions. Writing them is the caller's job
 * (src/api/open-finance-sync.ts), inside one transaction.
 *
 * The phases run over the WHOLE batch, in this order, because each one needs
 * the transactions the previous one did not claim:
 *
 *   0. A card purchase imported while PENDING is followed: posted, changed,
 *      recreated under a new id, or gone. Before phase 2, so a purchase that
 *      posted in this batch can be settled by its bill's payment in it too.
 *   1. A Previsto (or an open occurrence) is paid by the transaction that
 *      matches it. First, because it is the person's own plan — a pró-labore
 *      Previsto must claim its PIX before phase 3 reads that PIX as a mere
 *      Transferência, or the intercompany elimination (PRD §5) would lose it.
 *   2. A checking debit that mirrors a credit on a card it pays is the bill
 *      payment. Before phase 4, or it would become Consumo Livre and every
 *      purchase on the card would count twice.
 *   3. A debit and a credit between two linked accounts are a Transferência.
 *   4. What is left follows the account: Consumo Livre, card purchase, or a
 *      Lançamento through the de-para.
 */

import {
  type Cents,
  add,
  ZERO,
  type BankAccountId,
  type Entity,
  type EntryId,
  type IsoDate,
} from '@/domain/core'
import type { Entry, NewEntry } from '@/domain/entries'
import {
  isCardBillPayment,
  isOwnMoneyMovement,
  isRefund,
  uncategorizedFor,
} from './category-mapping'
import type {
  BalanceUpdate,
  CardBill,
  CardPurchaseChange,
  ImportDecision,
  ImportedTransaction,
  ImportPlan,
  ImportState,
  OpenFinanceLink,
  OpenFinanceSnapshot,
  PlannedCandidate,
  ProviderAccountId,
  ProviderTransactionId,
} from './types'

/**
 * PRD P49, decided 2026-09-29: same account, same amount to the cent, at most
 * five days apart. Exact because a looser amount pays the wrong Previsto in
 * silence; five days because a boleto due on a Saturday posts on Monday or
 * Tuesday.
 */
export const MATCH_WINDOW_DAYS = 5

/**
 * While a bill is open, the bank reports only the card's recent purchases:
 * "Fetches the last 7 days of transactions" (docs.pluggy.ai, "Credit Card
 * Installments"). Measured on 2026-10-01: connected on 29/09, the card showed
 * pending purchases from 25/09 on only. A pending purchase older than this
 * that goes missing has left the window, not been cancelled.
 */
export const RECENT_CARD_WINDOW_DAYS = 7

function daysBetween(a: IsoDate, b: IsoDate): number {
  const ms = Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`))
  return Math.round(ms / 86_400_000)
}

function byDate<T extends { date: IsoDate; id?: string }>(a: T, b: T): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  return (a.id ?? '') < (b.id ?? '') ? -1 : 1
}

/** The closest-in-date item that passes `fits`, or `undefined`. */
function nearest<T extends { date: IsoDate }>(
  items: readonly T[],
  date: IsoDate,
  fits: (item: T) => boolean,
): T | undefined {
  let best: T | undefined
  for (const item of items) {
    if (!fits(item) || daysBetween(item.date, date) > MATCH_WINDOW_DAYS) continue
    if (best === undefined || daysBetween(item.date, date) < daysBetween(best.date, date)) {
      best = item
    }
  }
  return best
}

export function planImport(snapshot: OpenFinanceSnapshot, state: ImportState): ImportPlan {
  const linkOf = new Map<ProviderAccountId, OpenFinanceLink>(
    state.links.map((link) => [link.providerAccountId, link]),
  )

  // Several provider investments may point at ONE Investimento (the owner's
  // decision of 2026-09-29: a bank reports each caixinha and each CDB apart,
  // and 36 lines in the Balanço is not how the person thinks of the money), so
  // balances are summed per target. A Conta Bancária still takes one account
  // only — the link route refuses a second.
  const balanceByTarget = new Map<string, BalanceUpdate>()
  for (const account of snapshot.accounts) {
    const link = linkOf.get(account.id)
    if (link === undefined || link.target.kind === 'CreditCard') continue
    const key = JSON.stringify(link.target)
    const previous = balanceByTarget.get(key)
    balanceByTarget.set(key, {
      target: link.target,
      balance: add(previous?.balance ?? ZERO, account.balance),
    })
  }
  const balances = [...balanceByTarget.values()]

  const fresh = snapshot.transactions.filter((t) => !state.alreadyImported.has(t.id))
  const decided = new Map<ProviderTransactionId, ImportDecision | null>()
  const decide = (t: ImportedTransaction, d: ImportDecision | null) => decided.set(t.id, d)
  const open = (t: ImportedTransaction) => !decided.has(t.id)

  const checkingAccountOf = (t: ImportedTransaction): BankAccountId | null => {
    const target = linkOf.get(t.accountId)?.target
    return target?.kind === 'BankAccount' ? target.bankAccountId : null
  }
  const providerAccountsOf = (bankAccountId: BankAccountId): Set<ProviderAccountId> =>
    new Set(
      state.links
        .filter((l) => l.target.kind === 'BankAccount' && l.target.bankAccountId === bankAccountId)
        .map((l) => l.providerAccountId),
    )
  const entityOf = (bankAccountId: BankAccountId): Entity => {
    const entity = state.bankAccountEntities.get(bankAccountId)
    if (entity === undefined) throw new Error('open_finance.unknown_bank_account')
    return entity
  }

  // Phase 0 — what is not ours to read.
  for (const t of fresh) {
    const link = linkOf.get(t.accountId)
    if (link === undefined) decide(t, { kind: 'Ignored', transaction: t, reason: 'Unlinked' })
    else if (t.date < link.linkedOn) {
      decide(t, { kind: 'Ignored', transaction: t, reason: 'BeforeLink' })
    } else if (link.target.kind === 'Investment') {
      decide(t, { kind: 'Ignored', transaction: t, reason: 'InvestmentMovement' })
    }
  }

  const ordered = [...fresh].sort(byDate)
  const bills = snapshot.bills ?? []
  const entryDateOf = (t: ImportedTransaction): IsoDate => {
    const billOf = (account: ProviderAccountId) => bills.filter((b) => b.accountId === account)
    return (
      bills.find((b) => b.id === t.billId)?.dueDate ??
      (t.pending === true ? projectedDueDate(billOf(t.accountId), t.date) : undefined) ??
      t.date
    )
  }

  // Phase 0b — the pending card purchases imported earlier (2026-10-01).
  //
  // Pluggy keeps the id when a purchase goes PENDING → POSTED, unless the
  // date, value or description changed enough that it deletes the transaction
  // and creates another (docs.pluggy.ai, "Transaction"). Its suggested anchor,
  // `providerId`, came back empty on all 14 card transactions measured on
  // 2026-10-01, so a recreated purchase is recognised the way P49 matches a
  // Previsto: same card, same value to the cent, at most five days apart.
  const cardPurchaseChanges: CardPurchaseChange[] = []
  const readCards = new Set(snapshot.accounts.map((a) => a.id))
  const snapshotById = new Map(snapshot.transactions.map((t) => [t.id, t]))
  const changed = new Map<EntryId, ImportedTransaction | null>()
  for (const purchase of state.unpaidCardPurchases) {
    const previousId = purchase.transactionId
    if (purchase.pending !== true || previousId === undefined) continue
    // A card the bank did not answer for this time says nothing about its purchases.
    if (!readCards.has(purchase.cardAccountId)) continue
    if (linkOf.get(purchase.cardAccountId)?.target.kind !== 'CreditCard') continue

    const now =
      snapshotById.get(previousId) ??
      nearest(ordered, purchase.date, (c) => {
        return (
          open(c) &&
          c.accountId === purchase.cardAccountId &&
          c.direction === 'Out' &&
          c.amount === purchase.amount
        )
      })
    if (now === undefined) {
      // Out of the window: it comes back POSTED when the bill closes, and the
      // person's category with it (the match above).
      if (
        state.today !== undefined &&
        daysBetween(purchase.date, state.today) >= RECENT_CARD_WINDOW_DAYS
      ) {
        continue
      }
      cardPurchaseChanges.push({
        kind: 'Vanished',
        entryId: purchase.entryId,
        transactionId: previousId,
      })
      changed.set(purchase.entryId, null)
      continue
    }
    if (now.id !== previousId) decide(now, null)
    const same =
      now.id === previousId &&
      now.pending === true &&
      now.amount === purchase.amount &&
      now.date === purchase.date &&
      (purchase.entryDate === undefined || purchase.entryDate === entryDateOf(now))
    if (same) continue
    cardPurchaseChanges.push({
      kind: 'Updated',
      entryId: purchase.entryId,
      previousTransactionId: previousId,
      transaction: now,
      entryDate: entryDateOf(now),
    })
    changed.set(purchase.entryId, now)
  }

  // Phase 1 — the person's plan claims its transaction first.
  const unclaimed = new Set<PlannedCandidate>(state.planned)
  for (const t of ordered) {
    const bankAccountId = checkingAccountOf(t)
    if (!open(t) || bankAccountId === null) continue
    const candidate = nearest([...unclaimed], t.date, (c) => {
      return (
        c.bankAccountId === bankAccountId && c.direction === t.direction && c.amount === t.amount
      )
    })
    if (candidate === undefined) continue
    unclaimed.delete(candidate)
    decide(t, { kind: 'PayPlanned', transaction: t, ref: candidate.ref })

    if (candidate.counterpart !== null) {
      const accounts = providerAccountsOf(candidate.counterpart.bankAccountId)
      const other = nearest(ordered, t.date, (o) => {
        return (
          open(o) &&
          accounts.has(o.accountId) &&
          o.direction === candidate.counterpart!.direction &&
          o.amount === t.amount
        )
      })
      if (other !== undefined) {
        decide(other, { kind: 'Ignored', transaction: other, reason: 'IntercompanyCounterpart' })
      }
    }
  }

  // Phase 2 — the bill payment, and which purchases it settles.
  //
  // A purchase belongs to ONE bill (`billId`), and a payment settles the bill
  // whose due date is nearest to it — only that bill's purchases. Measured on
  // 2026-09-29: the FIFO rule this replaced ("oldest purchases until the amount
  // paid is covered") let a payment of 11/09 — which paid the bill that closed
  // in AUGUST, whose purchases predate the link and were never imported —
  // settle seven purchases of 1–7/09 that belong to the OCTOBER bill; they
  // showed up as Pago in September's DRE. FIFO survives only as the fallback
  // for a provider that reports no bills.
  type Pooled = {
    entryId: EntryId | null
    txId: ProviderTransactionId | null
    date: IsoDate
    amount: number
    billId: string | null
  }
  const cardPool = new Map<ProviderAccountId, Pooled[]>()
  const pool = (card: ProviderAccountId) => {
    if (!cardPool.has(card)) cardPool.set(card, [])
    return cardPool.get(card)!
  }
  // A PENDING purchase is in the bill still OPEN: no payment made today can be
  // paying it, so it never enters the pool.
  for (const purchase of state.unpaidCardPurchases) {
    const now = changed.get(purchase.entryId)
    if (now === null) continue
    const current =
      now === undefined
        ? { ...purchase, pending: purchase.pending === true }
        : { ...purchase, amount: now.amount, billId: now.billId, pending: now.pending === true }
    if (current.pending) continue
    pool(purchase.cardAccountId).push({
      entryId: purchase.entryId,
      txId: null,
      date: purchase.date,
      amount: current.amount,
      billId: current.billId ?? null,
    })
  }
  for (const t of ordered) {
    if (!open(t) || linkOf.get(t.accountId)?.target.kind !== 'CreditCard') continue
    if (t.direction !== 'Out' || t.pending === true) continue
    pool(t.accountId).push({
      entryId: null,
      txId: t.id,
      date: t.date,
      amount: t.amount,
      billId: t.billId ?? null,
    })
  }
  for (const items of cardPool.values())
    items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  /** The bill a payment on `date` pays: the card's bill due nearest to it. */
  const billPaidOn = (card: ProviderAccountId, date: IsoDate) => {
    let best: (typeof bills)[number] | undefined
    for (const bill of bills) {
      if (bill.accountId !== card) continue
      if (best === undefined || daysBetween(bill.dueDate, date) < daysBetween(best.dueDate, date)) {
        best = bill
      }
    }
    return best
  }

  for (const t of ordered) {
    const bankAccountId = checkingAccountOf(t)
    if (!open(t) || bankAccountId === null || t.direction !== 'Out') continue
    const credit = nearest(ordered, t.date, (c) => {
      const target = linkOf.get(c.accountId)?.target
      return (
        open(c) &&
        c.direction === 'In' &&
        c.amount === t.amount &&
        target?.kind === 'CreditCard' &&
        target.paidByBankAccountId === bankAccountId
      )
    })
    if (credit === undefined) continue

    const items = pool(credit.accountId)
    const paidBill = billPaidOn(credit.accountId, t.date)
    const chosen: Pooled[] = []
    if (paidBill !== undefined) {
      for (const item of items) if (item.billId === paidBill.id) chosen.push(item)
    } else {
      let covered = 0
      for (const item of items) {
        if (item.date > t.date || covered + item.amount > t.amount) break
        covered += item.amount
        chosen.push(item)
      }
    }
    for (const item of chosen) items.splice(items.indexOf(item), 1)
    decide(t, {
      kind: 'CardBillPayment',
      transaction: t,
      settles: chosen.flatMap((i) => (i.entryId === null ? [] : [i.entryId])),
      settlesInBatch: chosen.flatMap((i) => (i.txId === null ? [] : [i.txId])),
    })
    decide(credit, { kind: 'Ignored', transaction: credit, reason: 'CardBillCredit' })
  }

  // Phase 3a — money between two provider accounts joined into the SAME Conta
  // Bancária (a bank that reported two products under one account number, 2026-09-29): the Conta Bancária's balance did not
  // move, so it is neither a Transferência nor an expense nor a revenue.
  for (const t of ordered) {
    const from = checkingAccountOf(t)
    if (!open(t) || from === null || t.direction !== 'Out') continue
    const counterpart = nearest(ordered, t.date, (c) => {
      return (
        open(c) &&
        c.accountId !== t.accountId &&
        checkingAccountOf(c) === from &&
        c.direction === 'In' &&
        c.amount === t.amount
      )
    })
    if (counterpart === undefined) continue
    decide(t, { kind: 'Ignored', transaction: t, reason: 'InternalMovement' })
    decide(counterpart, { kind: 'Ignored', transaction: counterpart, reason: 'InternalMovement' })
  }

  // Phase 3b — money between two linked accounts.
  for (const t of ordered) {
    const from = checkingAccountOf(t)
    if (!open(t) || from === null || t.direction !== 'Out') continue
    const counterpart = nearest(ordered, t.date, (c) => {
      const to = checkingAccountOf(c)
      return open(c) && to !== null && to !== from && c.direction === 'In' && c.amount === t.amount
    })
    if (counterpart === undefined) continue
    decide(t, { kind: 'Transfer', transaction: t, counterpart })
    // Recorded through the Transfer decision above; no decision of its own.
    decide(counterpart, null)
  }

  // Phase 4 — what is left follows the account.
  for (const t of ordered) {
    if (!open(t)) continue
    const target = linkOf.get(t.accountId)!.target

    if (target.kind === 'CreditCard') {
      if (t.direction === 'In') {
        decide(t, { kind: 'Ignored', transaction: t, reason: 'CardCredit' })
      } else {
        decide(t, {
          kind: 'CardPurchase',
          transaction: t,
          // Cash basis: Previsto in the month the bill is due — the bank's
          // bill when it has one, else the open bill's projected due date.
          // ADR-0021: the bank says it came from a card, so it arrives marked.
          entry: {
            ...entryFor(t, target.paidByBankAccountId, 'Planned'),
            date: entryDateOf(t),
            isCreditCard: true,
          } as NewEntry,
        })
      }
      continue
    }
    if (target.kind !== 'BankAccount') continue

    if (isOwnMoneyMovement(t.providerCategory)) {
      decide(t, { kind: 'Ignored', transaction: t, reason: 'OwnMoneyMovement' })
    } else if (t.direction === 'Out' && isCardBillPayment(t.providerCategory)) {
      // Unpaired (the card is not linked, or the amounts differ): still never
      // an expense — the purchases are the expense, the payment only settles them.
      decide(t, { kind: 'Ignored', transaction: t, reason: 'CardBillCredit' })
    } else if (
      t.direction === 'Out' &&
      target.bankAccountId === state.discretionarySourceAccountId
    ) {
      decide(t, { kind: 'DiscretionaryExpense', transaction: t })
    } else if (t.direction === 'In' && isRefund(t.providerCategory, t.description)) {
      decide(t, { kind: 'Ignored', transaction: t, reason: 'Refund' })
    } else {
      decide(t, { kind: 'Entry', transaction: t, entry: entryFor(t, target.bankAccountId, 'Paid') })
    }
  }

  function entryFor(
    t: ImportedTransaction,
    bankAccountId: BankAccountId,
    status: 'Paid' | 'Planned',
  ): NewEntry {
    const entity = entityOf(bankAccountId)
    return {
      kind: t.direction === 'Out' ? 'Expense' : 'Revenue',
      amount: t.amount,
      date: t.date,
      status,
      recurrenceId: null,
      entity,
      categoryId: uncategorizedFor(t.direction),
      classification: 'Current',
      bankAccountId,
      // O texto do banco é a Descrição do lançamento (2026-09-29).
      description: t.description.trim().slice(0, 200) || null,
    }
  }

  const decisions = fresh.flatMap((t) => {
    const d = decided.get(t.id)
    return d === undefined || d === null ? [] : [d]
  })
  return { balances, decisions, cardPurchaseChanges }
}

/**
 * Where a card's import starts: the day after its last bill closed, so the
 * bill still open is imported whole (owner's request, 2026-10-01). Measured
 * that day: linked on 29/09, the bill that closed on 08/09 was still open with
 * three purchases of 25–26/09 outside Bigorna — its payment would settle only
 * part of it, and the DRE of the payment month would fall short of what left
 * the account. Without a closing date, it is `today`, the link-day rule of
 * 2026-09-29 that still holds for every other account.
 */
export function cardImportStart(bills: readonly CardBill[], today: IsoDate): IsoDate {
  return lastClosedBill(bills, today)?.closingDate ?? today
}

/** The most recent bill whose closing date is known and not after `on`. */
function lastClosedBill(bills: readonly CardBill[], on: IsoDate): CardBill | undefined {
  let last: CardBill | undefined
  for (const bill of bills) {
    const closed = bill.closingDate
    if (closed === undefined || closed > on) continue
    if (last === undefined || closed > last.closingDate!) last = bill
  }
  return last
}

/** `date` moved by whole months, the day clamped to the month's end (31/01 + 1 → 28/02). */
function addMonthsToDate(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const total = y * 12 + (m - 1) + months
  const year = Math.floor(total / 12)
  const month = (total % 12) + 1
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}` as IsoDate
}

/**
 * The due date of the bill a purchase made on `date` falls into, projected
 * from the card's last closed bill — the open bill does not exist at the bank
 * yet ("open bills are not returned until the bills are closed",
 * docs.pluggy.ai, "Considerations & FAQ"). The owner, 2026-10-01: "melhor data
 * de compra é 8/10 e o vencimento é 15" — the closing day already belongs to
 * the next bill. The bank's real due date replaces this once the bill closes
 * (phase 0b). `undefined` when no closed bill says the cycle.
 */
export function projectedDueDate(
  bills: readonly CardBill[],
  purchaseDate: IsoDate,
): IsoDate | undefined {
  const last = lastClosedBill(bills, purchaseDate)
  if (last === undefined) return undefined
  let months = 1
  while (addMonthsToDate(last.closingDate!, months) <= purchaseDate) months += 1
  return addMonthsToDate(last.dueDate, months)
}

/**
 * The link that makes the bank the witness of `bankAccountId`, if any. Only a
 * `BankAccount` link counts: a card linked to an account says nothing about
 * the account's own debits.
 */
export function bankAccountLink(
  bankAccountId: BankAccountId,
  links: readonly OpenFinanceLink[],
): OpenFinanceLink | null {
  // Several provider accounts may feed one Conta Bancária: the bank became
  // the witness at the EARLIEST of their link dates.
  const own = links.filter(
    (l) => l.target.kind === 'BankAccount' && l.target.bankAccountId === bankAccountId,
  )
  return own.reduce<OpenFinanceLink | null>(
    (earliest, l) => (earliest === null || l.linkedOn < earliest.linkedOn ? l : earliest),
    null,
  )
}

/**
 * ADR-0020 §3: on a linked account, a Pago written by hand would duplicate
 * what the bank reports (it already became Consumo Livre, a card payment or a
 * Lançamento). A Previsto is still the person's to write — the sync pays it.
 *
 * Pró-labore and distribuição are the exception, and it is not a loophole:
 * the PIX between the two accounts is imported as a Transferência, which
 * creates no Lançamento, so the manual one is the ONLY record of it — and the
 * intercompany elimination (PRD §5) needs it.
 */
export function refusesManualPaid(
  entry: Pick<NewEntry, 'kind' | 'status' | 'date'> &
    Partial<Record<'bankAccountId', BankAccountId>>,
  links: readonly OpenFinanceLink[],
): boolean {
  if (entry.status !== 'Paid') return false
  if (entry.kind === 'ProLabore' || entry.kind === 'ProfitDistribution') return false
  if (entry.bankAccountId === undefined) return false
  const link = bankAccountLink(entry.bankAccountId, links)
  return link !== null && entry.date >= link.linkedOn
}

/**
 * "Vincular ao banco" (dono, 2026-10-09): a janela em que uma transação pode
 * ser ligada à mão a um lançamento. Maior que a do casamento automático
 * (`MATCH_WINDOW_DAYS`) porque aqui é a pessoa quem confirma — o depósito
 * lançado no dia 1º que caiu no dia 8 não casaria sozinho.
 */
export const BANK_LINK_WINDOW_DAYS = 15

/** O que a escolha precisa saber de uma transação já importada. */
export interface ImportedForLink {
  readonly transactionId: ProviderTransactionId
  readonly accountId: ProviderAccountId
  readonly date: IsoDate
  readonly amount: Cents
  readonly outcome: string
  readonly entryId: EntryId | null
}

/**
 * As transações que podem virar a testemunha de `entry`: as que viraram um
 * lançamento próprio (`Entry`) — o duplicado que o vínculo desfaz —, numa
 * conta do provedor vinculada à mesma Conta Bancária, no mesmo sentido e até
 * `BANK_LINK_WINDOW_DAYS` de distância. Mesmo valor primeiro, depois a mais
 * próxima. Um lançamento que já é a testemunha de alguma transação não tem
 * candidatas: ele já veio do banco.
 */
export function bankLinkCandidates<T extends ImportedForLink>(
  entry: Entry,
  imported: readonly T[],
  links: readonly OpenFinanceLink[],
  kindOf: (entryId: EntryId) => Entry['kind'] | undefined,
): T[] {
  if (imported.some((t) => t.entryId === entry.id)) return []
  const own = directionOf(entry)
  if (own === null) return []
  const providerAccounts = new Set(
    links
      .filter(
        (l) => l.target.kind === 'BankAccount' && l.target.bankAccountId === own.bankAccountId,
      )
      .map((l) => l.providerAccountId as string),
  )
  return imported
    .filter((t) => {
      if (t.outcome !== 'Entry' || t.entryId === null) return false
      if (!providerAccounts.has(t.accountId)) return false
      const kind = kindOf(t.entryId)
      const direction = kind === 'Expense' ? 'Out' : kind === 'Revenue' ? 'In' : null
      return direction === own.direction && daysBetween(t.date, entry.date) <= BANK_LINK_WINDOW_DAYS
    })
    .sort((a, b) => {
      const exactA = a.amount === entry.amount ? 0 : 1
      const exactB = b.amount === entry.amount ? 0 : 1
      if (exactA !== exactB) return exactA - exactB
      return daysBetween(a.date, entry.date) - daysBetween(b.date, entry.date)
    })
}

function directionOf(
  entry: Entry,
): { readonly bankAccountId: BankAccountId; readonly direction: 'In' | 'Out' } | null {
  switch (entry.kind) {
    case 'Expense':
      return { bankAccountId: entry.bankAccountId, direction: 'Out' }
    case 'Revenue':
      return { bankAccountId: entry.bankAccountId, direction: 'In' }
    case 'IncomeTax':
      return {
        bankAccountId: entry.bankAccountId,
        direction: entry.direction === 'Payment' ? 'Out' : 'In',
      }
    default:
      return null
  }
}
