/**
 * Lançamento — the transactional root of the product (Event Storming, Agregados).
 *
 * One entry per transaction, with the entity (PF/PJ) as an attribute and never
 * as a duplicated record (PRD §5). The four tabs of Novo Lançamento
 * (files_design/03) are one type discriminated by `kind`, so the compiler
 * refuses the combinations the forms cannot produce: pró-labore has no entity
 * (it affects both by definition) and IR has no category (which is exactly why
 * it keeps a Rótulo).
 */

import type {
  BankAccountId,
  CategoryId,
  Cents,
  Classification,
  Entity,
  EntryId,
  EntryStatus,
  IncomeTaxDirection,
  IsoDate,
  Month,
  RecurrenceId,
  View,
} from '@/domain/core'

/**
 * `Omit` applied to each member of a union instead of to the union as a whole.
 * Plain `Omit<Entry, 'id'>` collapses the five variants into the keys they all
 * share, throwing away `categoryId`, `sourceAccountId` and `direction` — and
 * with them the discrimination the compiler relies on.
 */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

interface EntryBase {
  readonly id: EntryId
  readonly amount: Cents
  /**
   * "Data de pagamento" / "Data do recebimento". It decides the accounting
   * month of the entry (PRD §5), unless a despesa carries a "Contabilizar em"
   * (ADR-0021).
   */
  readonly date: IsoDate
  readonly status: EntryStatus
  /** Set when the entry was born from a recurrence occurrence. */
  readonly recurrenceId: RecurrenceId | null
  /**
   * "Descrição" — free text saying what the Lançamento actually was (decisão do
   * dono, 2026-09-29: "sinto falta de uma descrição no lançamento"). Any kind
   * may carry one; an import fills it with the bank's text. Optional, and it
   * never decides anything: the category and the kind do. Not the Rótulo, which
   * exists only where there is no Categoria (IR, Consumo Livre).
   */
  readonly description?: string | null
}

/** files_design/03 "Novo Lançamento — Aba Despesa". No Rótulo: the category names it. */
export interface ExpenseEntry extends EntryBase {
  readonly kind: 'Expense'
  readonly entity: Entity
  readonly categoryId: CategoryId
  readonly classification: Classification
  readonly bankAccountId: BankAccountId
  /**
   * "Cartão de crédito" — whether the despesa was paid with a card (ADR-0021).
   * A mark only: it decides no status, date or month. Absent means `false`.
   */
  readonly isCreditCard?: boolean
  /**
   * "Contabilizar em" — the month the despesa is reported in, when the person
   * picked one other than the payment month (ADR-0021). `null` or absent: the
   * payment month (PRD §5). Kept apart from `date` so correcting the payment
   * date never moves a month the person chose.
   */
  readonly accountingMonth?: Month | null
}

/**
 * files_design/03 "Aba Receita" — same fields as Despesa. The differences are
 * UI only: the date is labelled "Data do recebimento" and `Paid` reads
 * "Recebido" (LABEL_STATUS in core handles both).
 */
export interface RevenueEntry extends EntryBase {
  readonly kind: 'Revenue'
  readonly entity: Entity
  readonly categoryId: CategoryId
  readonly classification: Classification
  readonly bankAccountId: BankAccountId
  /**
   * "Cartão de crédito" — a receita que entrou pelo cartão, como um estorno
   * (dono, 2026-10-09). A mark only, as on the despesa (ADR-0021).
   */
  readonly isCreditCard?: boolean
}

/**
 * Pró-labore: PJ → PF, always in that direction. The destination (PF) is
 * required; the source (PJ) is `null` when the money does not leave a PJ
 * account registered here (ADR-0018). No entity field — the intercompany
 * engine derives the PF/PJ/consolidated treatment from the kind
 * (files_design/03, PRD §5).
 */
export interface ProLaboreEntry extends EntryBase {
  readonly kind: 'ProLabore'
  readonly sourceAccountId: BankAccountId | null
  readonly destinationAccountId: BankAccountId
}

/** Same form as pró-labore; the accounting treatment differs (block 10, below the line). */
export interface ProfitDistributionEntry extends EntryBase {
  readonly kind: 'ProfitDistribution'
  readonly sourceAccountId: BankAccountId | null
  readonly destinationAccountId: BankAccountId
}

/**
 * files_design/03 "Aba IR". One account only: money out when `direction` is
 * `Payment`, money in when `Refund`. No category — hence the Rótulo, which is
 * what tells two IR entries apart in the Histórico.
 */
export interface IncomeTaxEntry extends EntryBase {
  readonly kind: 'IncomeTax'
  readonly direction: IncomeTaxDirection
  readonly entity: Entity
  readonly bankAccountId: BankAccountId
  readonly label: string | null
}

export type Entry =
  ExpenseEntry | RevenueEntry | ProLaboreEntry | ProfitDistributionEntry | IncomeTaxEntry

/** The two kinds the intercompany engine eliminates in the consolidated view. */
export type IntercompanyEntry = ProLaboreEntry | ProfitDistributionEntry

/** The two kinds that carry a category and a classification. */
export type CategorizedEntry = ExpenseEntry | RevenueEntry

/** What a form submits: everything but the id, which the store assigns. */
export type NewEntry = DistributiveOmit<Entry, 'id'>

export function isExpense(entry: Entry): entry is ExpenseEntry {
  return entry.kind === 'Expense'
}

export function isRevenue(entry: Entry): entry is RevenueEntry {
  return entry.kind === 'Revenue'
}

export function isProLabore(entry: Entry): entry is ProLaboreEntry {
  return entry.kind === 'ProLabore'
}

export function isProfitDistribution(entry: Entry): entry is ProfitDistributionEntry {
  return entry.kind === 'ProfitDistribution'
}

export function isIncomeTax(entry: Entry): entry is IncomeTaxEntry {
  return entry.kind === 'IncomeTax'
}

export function isCategorized(entry: Entry): entry is CategorizedEntry {
  return entry.kind === 'Expense' || entry.kind === 'Revenue'
}

/**
 * Filters of the Histórico screen — "todos os campos do agregado Lançamento"
 * (files_design/01 §7, files_design/03 "Histórico — filtros"). `null` means the
 * filter is not applied. `view` is the entity filter and accepts `Consolidated`,
 * which is why it is a `View` and not an `Entity`.
 */
export interface EntryFilter {
  readonly status: EntryStatus | null
  readonly view: View | null
  readonly month: Month | null
  readonly categoryId: CategoryId | null
  readonly classification: Classification | null
  readonly bankAccountId: BankAccountId | null
  readonly recurring: boolean | null
}
