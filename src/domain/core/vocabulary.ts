/**
 * Domain vocabulary — the enums that show up on nearly every screen.
 *
 * Identifiers are English (ADR-0010), but every concept maps 1:1 to a locked
 * Portuguese product term from files_design/04-glossario-de-nomenclatura.md.
 * The mapping lives in `src/domain/GLOSSARY.md` and in the `LABEL_*` records
 * below. Never rename a concept here without going through the glossary first:
 * "Lançamento" is the product's word, not "transação", and that choice was
 * argued and closed by the design team.
 *
 * UI strings stay in pt-BR — this is a Brazilian product and the screens must
 * match the Figma word for word.
 */

/** "Entidade" — Pessoa Física or Pessoa Jurídica. Kept untranslated: these are
 *  Brazilian legal categories with no English equivalent. It is an attribute of
 *  the entry, never a duplicated record (PRD §5). */
export const ENTITIES = ['PF', 'PJ'] as const
export type Entity = (typeof ENTITIES)[number]

/**
 * "Visão" — a report's point of view. Not the same set as `Entity`:
 * "Consolidated" is a projection with intercompany elimination applied, not a
 * third entity.
 */
export const VIEWS = ['Consolidated', 'PF', 'PJ'] as const
export type View = (typeof VIEWS)[number]

/**
 * "Status" — Previsto / Pago. On the Receita tab the UI label for `Paid` is
 * "Recebido" (files_design/01 §5.1b); the domain knows only two states.
 */
export const ENTRY_STATUSES = ['Planned', 'Paid'] as const
export type EntryStatus = (typeof ENTRY_STATUSES)[number]

/** "Classificação" — circulante / não circulante, feeding the balance sheet. */
export const CLASSIFICATIONS = ['Current', 'NonCurrent'] as const
export type Classification = (typeof CLASSIFICATIONS)[number]

/**
 * "Natureza" of an entry. `ProLabore` and `ProfitDistribution` are intercompany
 * and get distinct accounting treatment (ADR-0003): pró-labore reduces the PJ's
 * operating profit, profit distribution is an appropriation below the line.
 */
export const ENTRY_KINDS = [
  'Revenue',
  'Expense',
  'ProLabore',
  'ProfitDistribution',
  'IncomeTax',
] as const
export type EntryKind = (typeof ENTRY_KINDS)[number]

export const INTERCOMPANY_KINDS = ['ProLabore', 'ProfitDistribution'] as const

export function isIntercompany(kind: EntryKind): boolean {
  return (INTERCOMPANY_KINDS as readonly EntryKind[]).includes(kind)
}

/** Sub-type of the IR tab: the entry can be money going out or coming in. */
export const INCOME_TAX_DIRECTIONS = ['Payment', 'Refund'] as const
export type IncomeTaxDirection = (typeof INCOME_TAX_DIRECTIONS)[number]

/** A `Fixed` recurrence copies the amount; `ToBeDefined` generates a blank one (PRD §5). */
export const RECURRENCE_AMOUNT_KINDS = ['Fixed', 'ToBeDefined'] as const
export type RecurrenceAmountKind = (typeof RECURRENCE_AMOUNT_KINDS)[number]

/* -------------------------------------------------------------------------
 * UI labels, in pt-BR. The domain never formats text; screens read from here
 * so that a label is spelled the same way in every screen that shows it.
 * ---------------------------------------------------------------------- */

export const LABEL_STATUS: Record<EntryKind, Record<EntryStatus, string>> = {
  // "Recebido", not "Pago", on the Receita tab — files_design/01 §5.1b.
  Revenue: { Planned: 'Previsto', Paid: 'Recebido' },
  Expense: { Planned: 'Previsto', Paid: 'Pago' },
  ProLabore: { Planned: 'Previsto', Paid: 'Pago' },
  ProfitDistribution: { Planned: 'Previsto', Paid: 'Pago' },
  IncomeTax: { Planned: 'Previsto', Paid: 'Pago' },
}

export const LABEL_CLASSIFICATION: Record<Classification, string> = {
  Current: 'Circulante',
  NonCurrent: 'Não circulante',
}

export const LABEL_ENTITY: Record<Entity, string> = { PF: 'PF', PJ: 'PJ' }

export const LABEL_VIEW: Record<View, string> = {
  Consolidated: 'Consolidado',
  PF: 'PF',
  PJ: 'PJ',
}

export const LABEL_ENTRY_KIND: Record<EntryKind, string> = {
  Revenue: 'Receita',
  Expense: 'Despesa',
  ProLabore: 'Pró-labore',
  ProfitDistribution: 'Distribuição de lucro',
  IncomeTax: 'IR',
}

export const LABEL_INCOME_TAX_DIRECTION: Record<IncomeTaxDirection, string> = {
  Payment: 'Pagamento',
  Refund: 'Recebimento',
}

export const LABEL_RECURRENCE_AMOUNT_KIND: Record<RecurrenceAmountKind, string> = {
  Fixed: 'Fixo',
  ToBeDefined: 'A definir',
}
