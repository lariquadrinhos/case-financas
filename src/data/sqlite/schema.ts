/**
 * The SQLite schema — one adapter's storage layout, never the domain model.
 *
 * Five rules hold for every table here, and each one has a reason that is not
 * taste:
 *
 * 1. **Every table has `user_id`, NOT NULL, and it is the FIRST column of every
 *    key and every index** (ADR-0008 §3). No row exists outside a user scope,
 *    and the primary key being `(user_id, id)` means a query that forgets the
 *    scope cannot use the index — the mistake is slow AND wrong, not just wrong.
 * 2. **Foreign keys are composite**, `(user_id, <ref>_id)`. A plain
 *    `category_id` reference would let one person's entry point at another
 *    person's category and the database would accept it. This one does not.
 * 3. **No `ON DELETE CASCADE` anywhere.** A Lançamento is a record, not a detail
 *    of an account: deleting a conta bancária must fail loudly and let the app
 *    explain, never silently take the history with it. Everything is RESTRICT.
 * 4. **Money is `integer` (cents), dates and months are `text`** (ADR-0001 §5,
 *    §2). There is no REAL column in this file and there never should be: a
 *    float column would round a cent somewhere no test looks.
 * 5. **The `entries` table flattens the discriminated union**: a `kind` column
 *    plus nullable columns per variant, with a CHECK constraint per kind saying
 *    which must be present and which must be NULL. The compiler protects the
 *    domain; the database has to protect itself, because a migration script or a
 *    `sqlite3` session does not typecheck.
 */

import { sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

/* -------------------------------------------------------------------------
 * Shared column vocabulary
 * ---------------------------------------------------------------------- */

const ENTITY = ['PF', 'PJ'] as const
const VIEWS = ['Consolidated', 'PF', 'PJ'] as const
const STATUS = ['Planned', 'Paid'] as const
const CLASSIFICATION = ['Current', 'NonCurrent'] as const
const ENTRY_KIND = ['Expense', 'Revenue', 'ProLabore', 'ProfitDistribution', 'IncomeTax'] as const
const IR_DIRECTION = ['Payment', 'Refund'] as const
const CASCADE_EFFECT = ['Add', 'Subtract', 'Signed', 'None'] as const
const AMOUNT_KIND = ['Fixed', 'ToBeDefined'] as const
const BUCKET = [
  'InvestmentContribution',
  'DividendReinvestment',
  'ExtraordinaryConsumption',
  'CashReserve',
] as const
const DESTINATION_KIND = ['Investment', 'BankAccount', 'FreeText'] as const
const PENDING_STATUS = ['Pending', 'Allocated'] as const
const PAYMENT_DISCREPANCY_STATUS = ['Pending', 'Resolved'] as const
const TRACE_KIND = [
  'Registration',
  'RateAdjustment',
  'InstallmentPaid',
  'RecurrencePaid',
  'Discrepancy',
  'Transfer',
] as const
/**
 * `Entry` was added for a divergent payment on a STANDALONE Lançamento
 * (`POST /entries/{id}/payment`) — the only payment path that is neither a
 * Passivo nor a Recorrência (`@/domain/pending-items`, H13 wiring).
 */
const TRACE_ORIGIN = ['Liability', 'Recurrence', 'Entry', 'BankAccount', 'Investment'] as const
const ONBOARDING_STATUS = ['InProgress', 'Dismissed', 'Completed'] as const

/** `user_id` is spelled the same way in all eighteen tables, on purpose. */
const userId = () => text('user_id').notNull()

/* -------------------------------------------------------------------------
 * users
 * ---------------------------------------------------------------------- */

/**
 * The scope every other table hangs from. There is no authentication in this
 * phase (ADR-0008 §1), so today this table holds exactly one row — the local
 * development user. It exists anyway, because the alternative is a `user_id`
 * column that references nothing and a phase-2 migration that has to invent the
 * parent rows retroactively.
 *
 * Minimisation (ADR-0009 §4): no name, no e-mail, no CPF. Only the opaque id.
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
})

/* -------------------------------------------------------------------------
 * Plano de Contas
 * ---------------------------------------------------------------------- */

export const statementBlocks = sqliteTable(
  'statement_blocks',
  {
    userId: userId(),
    id: text('id').notNull(),
    name: text('name').notNull(),
    /** `order` is reserved in SQL; the domain field keeps its name, the column does not. */
    order: integer('sort_order').notNull(),
    effect: text('effect', { enum: CASCADE_EFFECT }).notNull(),
    belowTheLine: integer('below_the_line', { mode: 'boolean' }).notNull(),
    acceptsUserCategories: integer('accepts_user_categories', { mode: 'boolean' }).notNull(),
    statementLabel: text('statement_label'),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete('restrict'),
    index('statement_blocks_user_order_idx').on(t.userId, t.order),
  ],
)

export const categories = sqliteTable(
  'categories',
  {
    userId: userId(),
    id: text('id').notNull(),
    blockId: text('block_id').notNull(),
    name: text('name').notNull(),
    /** "Consumo Livre": created by the product, never renamed nor archived. */
    isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
    suggestedClassification: text('suggested_classification', { enum: CLASSIFICATION }),
    /** There is no delete: an unused category is archived (files_design/01 §3.1). */
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    /** Counts toward "Cobertura por renda passiva" (P22, decisão de 2026-09-08). */
    isPassiveIncome: integer('is_passive_income', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    foreignKey({
      columns: [t.userId, t.blockId],
      foreignColumns: [statementBlocks.userId, statementBlocks.id],
    }).onDelete('restrict'),
    index('categories_user_block_idx').on(t.userId, t.blockId),
    index('categories_user_archived_idx').on(t.userId, t.archived),
  ],
)

/* -------------------------------------------------------------------------
 * Patrimônio
 * ---------------------------------------------------------------------- */

export const bankAccounts = sqliteTable(
  'bank_accounts',
  {
    userId: userId(),
    id: text('id').notNull(),
    label: text('label').notNull(),
    /** A palette token name, never a hex: colour is presentation (ADR-0011). */
    colour: text('colour').notNull(),
    entity: text('entity', { enum: ENTITY }).notNull(),
    /** Kept by the person, not derived from the entries (PRD §1). */
    balance: integer('balance').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete('restrict'),
    index('bank_accounts_user_entity_idx').on(t.userId, t.entity),
  ],
)

export const tangibleAssets = sqliteTable(
  'tangible_assets',
  {
    userId: userId(),
    id: text('id').notNull(),
    name: text('name').notNull(),
    entity: text('entity', { enum: ENTITY }).notNull(),
    /** No monthly depreciation: this is what the asset is carried at (PRD §5). */
    recordedValue: integer('recorded_value').notNull(),
    soldOn: text('sold_on'),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete('restrict'),
    index('tangible_assets_user_sold_idx').on(t.userId, t.soldOn),
  ],
)

export const investments = sqliteTable(
  'investments',
  {
    userId: userId(),
    id: text('id').notNull(),
    name: text('name').notNull(),
    entity: text('entity', { enum: ENTITY }).notNull(),
    /** Opening balance plus contributions. No mark-to-market (PRD §1). */
    accumulatedValue: integer('accumulated_value').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete('restrict'),
    index('investments_user_entity_idx').on(t.userId, t.entity),
  ],
)

export const liabilities = sqliteTable(
  'liabilities',
  {
    userId: userId(),
    id: text('id').notNull(),
    name: text('name').notNull(),
    creditor: text('creditor').notNull(),
    entity: text('entity', { enum: ENTITY }).notNull(),
    classification: text('classification', { enum: CLASSIFICATION }).notNull(),
    originalAmount: integer('original_amount').notNull(),
    installmentAmount: integer('installment_amount').notNull(),
    installmentCount: integer('installment_count').notNull(),
    installmentsAlreadyPaid: integer('installments_already_paid').notNull().default(0),
    /**
     * The only `real` column in the schema, and it is not money: it is a rate as
     * a decimal fraction (0.0085 = 0,85% a.m.), the unit `multiply` in
     * `core/money` expects. Storing it as an integer of basis points would be a
     * second unit to convert at every boundary.
     */
    monthlyInterestRate: real('monthly_interest_rate').notNull(),
    startDate: text('start_date').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete('restrict'),
    index('liabilities_user_entity_idx').on(t.userId, t.entity),
    check('liabilities_count_positive', sql`${t.installmentCount} > 0`),
    check(
      'liabilities_already_paid_in_range',
      sql`${t.installmentsAlreadyPaid} >= 0 AND ${t.installmentsAlreadyPaid} <= ${t.installmentCount}`,
    ),
    check('liabilities_rate_non_negative', sql`${t.monthlyInterestRate} >= 0`),
  ],
)

/**
 * A row of the amortisation schedule. Generated from the Passivo form and
 * recomputed on every rate adjustment — never typed by the person
 * (files_design/03, §6).
 */
export const installments = sqliteTable(
  'installments',
  {
    userId: userId(),
    id: text('id').notNull(),
    liabilityId: text('liability_id').notNull(),
    number: integer('number').notNull(),
    plannedDate: text('planned_date').notNull(),
    plannedAmount: integer('planned_amount').notNull(),
    status: text('status', { enum: STATUS }).notNull(),
    paidAmount: integer('paid_amount'),
    paidDate: text('paid_date'),
    // "Descartar" na Revisão de Recorrentes (Figma 10:2 nó 144:17): pula a
    // linha DESTE mês; a parcela segue Prevista e o cronograma não se desloca
    // (Figma 34:2 nó 34:36). Mesma coluna que `occurrences.discarded`.
    discarded: integer('discarded', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    foreignKey({
      columns: [t.userId, t.liabilityId],
      foreignColumns: [liabilities.userId, liabilities.id],
    }).onDelete('restrict'),
    index('installments_user_liability_idx').on(t.userId, t.liabilityId, t.number),
    index('installments_user_status_date_idx').on(t.userId, t.status, t.plannedDate),
    // "Valor pago (real): preenchido só quando status = Paga" (files_design/03).
    check(
      'installments_paid_amount_shape',
      sql`(${t.status} = 'Paid') OR (${t.paidAmount} IS NULL)`,
    ),
  ],
)

export const rateAdjustments = sqliteTable(
  'rate_adjustments',
  {
    userId: userId(),
    id: text('id').notNull(),
    liabilityId: text('liability_id').notNull(),
    newRate: real('new_rate').notNull(),
    effectiveFrom: text('effective_from').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    foreignKey({
      columns: [t.userId, t.liabilityId],
      foreignColumns: [liabilities.userId, liabilities.id],
    }).onDelete('restrict'),
    index('rate_adjustments_user_liability_idx').on(t.userId, t.liabilityId, t.effectiveFrom),
    check('rate_adjustments_rate_non_negative', sql`${t.newRate} >= 0`),
  ],
)

/* -------------------------------------------------------------------------
 * Recorrência
 * ---------------------------------------------------------------------- */

/**
 * The series. Its `template_*` columns are the Lançamento data copied into every
 * occurrence, flattened exactly like `entries` and guarded by the same kind of
 * CHECK — `RecurrenceTemplate` is literally an `Entry` without the fields that
 * belong to a single month (src/domain/recurrence/types.ts).
 */
export const recurrences = sqliteTable(
  'recurrences',
  {
    userId: userId(),
    id: text('id').notNull(),
    amountKind: text('amount_kind', { enum: AMOUNT_KIND }).notNull(),
    startDate: text('start_date').notNull(),
    /** `null` is an open-ended series. */
    endsOn: text('ends_on'),
    /** "Encerrar recorrência": stops the series for good. */
    closedOn: text('closed_on'),

    templateKind: text('template_kind', { enum: ENTRY_KIND }).notNull(),
    /** `null` for a "a definir" series, which is born blank every month (PRD §5). */
    templateAmount: integer('template_amount'),
    templateEntity: text('template_entity', { enum: ENTITY }),
    templateCategoryId: text('template_category_id'),
    templateClassification: text('template_classification', { enum: CLASSIFICATION }),
    templateBankAccountId: text('template_bank_account_id'),
    templateSourceAccountId: text('template_source_account_id'),
    templateDestinationAccountId: text('template_destination_account_id'),
    templateDirection: text('template_direction', { enum: IR_DIRECTION }),
    templateLabel: text('template_label'),
    /** The Descrição, copied into every month (2026-10-01; it was dropped on write). */
    templateDescription: text('template_description'),
    /** "Cartão de crédito", copied into every month (ADR-0021). */
    templateIsCreditCard: integer('template_is_credit_card', { mode: 'boolean' })
      .notNull()
      .default(false),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete('restrict'),
    foreignKey({
      columns: [t.userId, t.templateCategoryId],
      foreignColumns: [categories.userId, categories.id],
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.userId, t.templateBankAccountId],
      foreignColumns: [bankAccounts.userId, bankAccounts.id],
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.userId, t.templateSourceAccountId],
      foreignColumns: [bankAccounts.userId, bankAccounts.id],
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.userId, t.templateDestinationAccountId],
      foreignColumns: [bankAccounts.userId, bankAccounts.id],
    }).onDelete('restrict'),
    index('recurrences_user_open_idx').on(t.userId, t.closedOn),
    check(
      'recurrences_template_categorized_shape',
      sql`${t.templateKind} NOT IN ('Expense', 'Revenue') OR (
            ${t.templateEntity} IS NOT NULL AND ${t.templateCategoryId} IS NOT NULL
            AND ${t.templateClassification} IS NOT NULL AND ${t.templateBankAccountId} IS NOT NULL
            AND ${t.templateSourceAccountId} IS NULL AND ${t.templateDestinationAccountId} IS NULL
            AND ${t.templateDirection} IS NULL AND ${t.templateLabel} IS NULL)`,
    ),
    check(
      'recurrences_template_intercompany_shape',
      sql`${t.templateKind} NOT IN ('ProLabore', 'ProfitDistribution') OR (
            ${t.templateDestinationAccountId} IS NOT NULL
            AND ${t.templateEntity} IS NULL AND ${t.templateCategoryId} IS NULL
            AND ${t.templateClassification} IS NULL AND ${t.templateBankAccountId} IS NULL
            AND ${t.templateDirection} IS NULL AND ${t.templateLabel} IS NULL)`,
    ),
    check(
      'recurrences_template_income_tax_shape',
      sql`${t.templateKind} <> 'IncomeTax' OR (
            ${t.templateDirection} IS NOT NULL AND ${t.templateEntity} IS NOT NULL
            AND ${t.templateBankAccountId} IS NOT NULL
            AND ${t.templateCategoryId} IS NULL AND ${t.templateClassification} IS NULL
            AND ${t.templateSourceAccountId} IS NULL AND ${t.templateDestinationAccountId} IS NULL)`,
    ),
  ],
)

/* -------------------------------------------------------------------------
 * Lançamentos
 * ---------------------------------------------------------------------- */

/**
 * The transactional root. One row per transaction, with the entity as a COLUMN
 * and never as a duplicated row per entity (PRD §5).
 *
 * `date` is the payment date the person entered, and it alone decides the
 * accounting month. There is deliberately no `created_at`, no `posted_at` and no
 * timestamp: a second date column is a second candidate for "which month is
 * this?", and the answer must have exactly one candidate.
 *
 * The four CHECKs below are the union's discriminant, enforced by the database.
 * They are what stops a hand-written `INSERT` from creating a pró-labore with a
 * category or an IR with two accounts — combinations the TypeScript type refuses
 * and a `sqlite3` prompt would happily write.
 */
export const entries = sqliteTable(
  'entries',
  {
    userId: userId(),
    id: text('id').notNull(),
    kind: text('kind', { enum: ENTRY_KIND }).notNull(),
    amount: integer('amount').notNull(),
    /** "Data de pagamento" / "Data do recebimento" — the cash-basis month (PRD §5). */
    date: text('date').notNull(),
    status: text('status', { enum: STATUS }).notNull(),
    recurrenceId: text('recurrence_id'),

    // Expense / Revenue
    entity: text('entity', { enum: ENTITY }),
    categoryId: text('category_id'),
    classification: text('classification', { enum: CLASSIFICATION }),
    bankAccountId: text('bank_account_id'),

    // ProLabore / ProfitDistribution — always PJ → PF
    sourceAccountId: text('source_account_id'),
    destinationAccountId: text('destination_account_id'),

    // IncomeTax
    direction: text('direction', { enum: IR_DIRECTION }),
    /** Rótulo: only IR has one, because IR has no Categoria (files_design/03). */
    label: text('label'),
    /** "Descrição" — free text, any kind (2026-09-29). Never personal-data-free: never log it. */
    description: text('description'),
    /** "Cartão de crédito" — Despesa only, a mark that decides nothing (ADR-0021). */
    isCreditCard: integer('is_credit_card', { mode: 'boolean' }).notNull().default(false),
    /**
     * "Contabilizar em" (YYYY-MM) — Despesa only. `null`: the month of `date`
     * (PRD §5). Set: the month every report reads instead (ADR-0021).
     */
    accountingMonth: text('accounting_month'),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete('restrict'),
    foreignKey({
      columns: [t.userId, t.categoryId],
      foreignColumns: [categories.userId, categories.id],
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.userId, t.bankAccountId],
      foreignColumns: [bankAccounts.userId, bankAccounts.id],
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.userId, t.sourceAccountId],
      foreignColumns: [bankAccounts.userId, bankAccounts.id],
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.userId, t.destinationAccountId],
      foreignColumns: [bankAccounts.userId, bankAccounts.id],
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.userId, t.recurrenceId],
      foreignColumns: [recurrences.userId, recurrences.id],
    }).onDelete('restrict'),

    /**
     * Every report filters by month, and the month is `substr(date, 1, 7)` —
     * which is why the date format is YYYY-MM-DD: the index on `(user_id, date)`
     * serves both the day and the month, and a prefix comparison is enough.
     */
    index('entries_user_date_idx').on(t.userId, t.date),
    index('entries_user_status_date_idx').on(t.userId, t.status, t.date),
    index('entries_user_category_idx').on(t.userId, t.categoryId),
    index('entries_user_account_idx').on(t.userId, t.bankAccountId),
    index('entries_user_recurrence_idx').on(t.userId, t.recurrenceId),
    index('entries_user_accounting_month_idx').on(t.userId, t.accountingMonth),

    check(
      'entries_expense_revenue_shape',
      sql`${t.kind} NOT IN ('Expense', 'Revenue') OR (
            ${t.entity} IS NOT NULL AND ${t.categoryId} IS NOT NULL
            AND ${t.classification} IS NOT NULL AND ${t.bankAccountId} IS NOT NULL
            AND ${t.sourceAccountId} IS NULL AND ${t.destinationAccountId} IS NULL
            AND ${t.direction} IS NULL AND ${t.label} IS NULL)`,
    ),
    check(
      'entries_intercompany_shape',
      sql`${t.kind} NOT IN ('ProLabore', 'ProfitDistribution') OR (
            ${t.destinationAccountId} IS NOT NULL
            AND ${t.entity} IS NULL AND ${t.categoryId} IS NULL
            AND ${t.classification} IS NULL AND ${t.bankAccountId} IS NULL
            AND ${t.direction} IS NULL AND ${t.label} IS NULL)`,
    ),
    check(
      'entries_income_tax_shape',
      sql`${t.kind} <> 'IncomeTax' OR (
            ${t.direction} IS NOT NULL AND ${t.entity} IS NOT NULL
            AND ${t.bankAccountId} IS NOT NULL
            AND ${t.categoryId} IS NULL AND ${t.classification} IS NULL
            AND ${t.sourceAccountId} IS NULL AND ${t.destinationAccountId} IS NULL)`,
    ),
    /**
     * A date column is only a date if it is one: the reports slice it as text.
     *
     * The class pattern is not decoration. Measured: `GLOB '____-__-__'` matches
     * the literal string "____-__-__" and rejected '2026-01-01' — `_` is a LIKE
     * wildcard, not a GLOB one.
     */
    check('entries_date_format', sql`${t.date} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`),
  ],
)

export const occurrences = sqliteTable(
  'occurrences',
  {
    userId: userId(),
    id: text('id').notNull(),
    recurrenceId: text('recurrence_id').notNull(),
    month: text('month').notNull(),
    plannedDate: text('planned_date').notNull(),
    /** `null` while a "a definir" series has not been filled in (PRD §5). */
    plannedAmount: integer('planned_amount'),
    status: text('status', { enum: STATUS }).notNull(),
    /** "Descartar": skips this month only; the series continues. */
    discarded: integer('discarded', { mode: 'boolean' }).notNull().default(false),
    entryId: text('entry_id'),
    /** "Só esta ocorrência": this month's Descrição, over the series' (2026-10-01). */
    description: text('description'),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    foreignKey({
      columns: [t.userId, t.recurrenceId],
      foreignColumns: [recurrences.userId, recurrences.id],
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.userId, t.entryId],
      foreignColumns: [entries.userId, entries.id],
    }).onDelete('restrict'),
    index('occurrences_user_month_idx').on(t.userId, t.month),
    index('occurrences_user_recurrence_idx').on(t.userId, t.recurrenceId, t.month),
    check('occurrences_month_format', sql`${t.month} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'`),
    // A paid occurrence is the one that produced a Lançamento; a Previsto one has none.
    check('occurrences_paid_has_entry', sql`(${t.status} = 'Paid') OR (${t.entryId} IS NULL)`),
  ],
)

/* -------------------------------------------------------------------------
 * Destinação do Lucro
 * ---------------------------------------------------------------------- */

/**
 * One allocation per month: the month IS the identity (PRD UC6). Deliberately
 * without an entity column — it is a single consolidated decision about the
 * combined result (files_design/02).
 */
export const profitAllocations = sqliteTable(
  'profit_allocations',
  {
    userId: userId(),
    month: text('month').notNull(),
    /** The Lucro Líquido the DRE computed when the allocation was made. */
    netProfit: integer('net_profit').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.month] }),
    foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete('restrict'),
    check(
      'profit_allocations_month_format',
      sql`${t.month} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'`,
    ),
  ],
)

export const allocationItems = sqliteTable(
  'allocation_items',
  {
    userId: userId(),
    id: text('id').notNull(),
    month: text('month').notNull(),
    bucket: text('bucket', { enum: BUCKET }).notNull(),
    /** Keeps the order the person added the items in — the cards are lists. */
    position: integer('position').notNull(),
    /** `null` is an INCOMPLETE item, which is allowed and becomes a Pendência. */
    destinationKind: text('destination_kind', { enum: DESTINATION_KIND }),
    destinationInvestmentId: text('destination_investment_id'),
    destinationBankAccountId: text('destination_bank_account_id'),
    destinationName: text('destination_name'),
    amount: integer('amount').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    foreignKey({
      columns: [t.userId, t.month],
      foreignColumns: [profitAllocations.userId, profitAllocations.month],
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.userId, t.destinationInvestmentId],
      foreignColumns: [investments.userId, investments.id],
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.userId, t.destinationBankAccountId],
      foreignColumns: [bankAccounts.userId, bankAccounts.id],
    }).onDelete('restrict'),
    index('allocation_items_user_month_idx').on(t.userId, t.month, t.bucket, t.position),
    check('allocation_items_amount_non_negative', sql`${t.amount} >= 0`),
    /**
     * The destination that each bucket accepts (files_design/02: "Destinar o
     * Lucro ganhou campos de destino específico por balde"). The screen only ever
     * renders the matching field, so a row with the wrong one is a row no screen
     * can show.
     */
    check(
      'allocation_items_destination_shape',
      sql`${t.destinationKind} IS NULL OR (
            (${t.destinationKind} = 'Investment' AND ${t.destinationInvestmentId} IS NOT NULL
              AND ${t.destinationBankAccountId} IS NULL AND ${t.destinationName} IS NULL)
            OR (${t.destinationKind} = 'BankAccount' AND ${t.destinationBankAccountId} IS NOT NULL
              AND ${t.destinationInvestmentId} IS NULL AND ${t.destinationName} IS NULL)
            OR (${t.destinationKind} = 'FreeText' AND ${t.destinationName} IS NOT NULL
              AND ${t.destinationInvestmentId} IS NULL AND ${t.destinationBankAccountId} IS NULL))`,
    ),
  ],
)

/**
 * Money left undirected after a sale (files_design/03). The Home shows a banner
 * while `status` is `Pending`.
 */
export const pendingAllocations = sqliteTable(
  'pending_allocations',
  {
    userId: userId(),
    id: text('id').notNull(),
    /** One-variant union today: the sale of a bem material is the only origin. */
    originKind: text('origin_kind', { enum: ['TangibleAssetSale'] }).notNull(),
    originTangibleAssetId: text('origin_tangible_asset_id').notNull(),
    amount: integer('amount').notNull(),
    originDate: text('origin_date').notNull(),
    status: text('status', { enum: PENDING_STATUS }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    foreignKey({
      columns: [t.userId, t.originTangibleAssetId],
      foreignColumns: [tangibleAssets.userId, tangibleAssets.id],
    }).onDelete('restrict'),
    index('pending_allocations_user_status_idx').on(t.userId, t.status, t.originDate),
  ],
)

/**
 * Divergência de pagamento a menor — Pendência tipo 4 (H13,
 * `@/domain/pending-items`). One-variant origin, same reasoning as
 * `pendingAllocations` above: both payment routes end with a stored `Entry`,
 * so the entry is always what the shortfall is paid against.
 */
/**
 * Um pedaço da sobra de um mês, já direcionado — P14 (produto, 2026-09-08).
 *
 * Guarda o DIRECIONAMENTO, não a pendência: a pendência da Home continua
 * derivada (`sobra(mês) − soma daqui`), o que preserva ADR-0001 §1 e dispensa
 * materializar qualquer coisa no virar do mês.
 *
 * `destination_*` é uma união marcada achatada em colunas, como
 * `payment_discrepancies.origin_*` já faz: `kind` diz qual das três chaves
 * vale, e `Discretionary` — a sobra voltando para a verba do mês — não usa
 * nenhuma.
 */
export const leftoverDirections = sqliteTable(
  'leftover_directions',
  {
    userId: userId(),
    id: text('id').notNull(),
    /** O mês de ORIGEM da sobra, "YYYY-MM". */
    month: text('month').notNull(),
    amount: integer('amount').notNull(),
    destinationKind: text('destination_kind', {
      enum: ['Discretionary', 'BankAccount', 'Investment', 'Liability'],
    }).notNull(),
    destinationBankAccountId: text('destination_bank_account_id'),
    destinationInvestmentId: text('destination_investment_id'),
    destinationLiabilityId: text('destination_liability_id'),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    check('leftover_directions_amount_positive', sql`${t.amount} > 0`),
  ],
)

export const paymentDiscrepancies = sqliteTable(
  'payment_discrepancies',
  {
    userId: userId(),
    id: text('id').notNull(),
    originKind: text('origin_kind', { enum: ['Entry'] }).notNull(),
    originEntryId: text('origin_entry_id').notNull(),
    shortfall: integer('shortfall').notNull(),
    originDate: text('origin_date').notNull(),
    status: text('status', { enum: PAYMENT_DISCREPANCY_STATUS }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    foreignKey({
      columns: [t.userId, t.originEntryId],
      foreignColumns: [entries.userId, entries.id],
    }).onDelete('restrict'),
    index('payment_discrepancies_user_status_idx').on(t.userId, t.status, t.originDate),
    check('payment_discrepancies_shortfall_positive', sql`${t.shortfall} > 0`),
  ],
)

/* -------------------------------------------------------------------------
 * Rastreabilidade
 * ---------------------------------------------------------------------- */

/**
 * `description` contains a monetary amount ("Parcela #12 paga: previsto
 * R$ 1.520,00"). It is product data, rendered on screen, and it must NEVER reach
 * `src/lib/log.ts` — ADR-0009 §3 spells this out as a consequence.
 */
export const traceEvents = sqliteTable(
  'trace_events',
  {
    userId: userId(),
    id: text('id').notNull(),
    date: text('date').notNull(),
    kind: text('kind', { enum: TRACE_KIND }).notNull(),
    originKind: text('origin_kind', { enum: TRACE_ORIGIN }).notNull(),
    originLiabilityId: text('origin_liability_id'),
    originRecurrenceId: text('origin_recurrence_id'),
    originEntryId: text('origin_entry_id'),
    // ADR-0017 §3: uma Transferência nasce de uma posição. A origem gravada é o
    // DESTINO — ver o comentário em `TraceEventOrigin`.
    originBankAccountId: text('origin_bank_account_id'),
    originInvestmentId: text('origin_investment_id'),
    description: text('description').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    foreignKey({
      columns: [t.userId, t.originLiabilityId],
      foreignColumns: [liabilities.userId, liabilities.id],
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.userId, t.originRecurrenceId],
      foreignColumns: [recurrences.userId, recurrences.id],
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.userId, t.originEntryId],
      foreignColumns: [entries.userId, entries.id],
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.userId, t.originBankAccountId],
      foreignColumns: [bankAccounts.userId, bankAccounts.id],
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.userId, t.originInvestmentId],
      foreignColumns: [investments.userId, investments.id],
    }).onDelete('restrict'),
    // The Home reads the last five of the whole product, newest first.
    index('trace_events_user_date_idx').on(t.userId, t.date),
    index('trace_events_user_liability_idx').on(t.userId, t.originLiabilityId, t.date),
    check(
      'trace_events_origin_shape',
      sql`(${t.originKind} = 'Liability' AND ${t.originLiabilityId} IS NOT NULL
             AND ${t.originRecurrenceId} IS NULL AND ${t.originEntryId} IS NULL)
          OR (${t.originKind} = 'Recurrence' AND ${t.originRecurrenceId} IS NOT NULL
             AND ${t.originLiabilityId} IS NULL AND ${t.originEntryId} IS NULL)
          OR (${t.originKind} = 'Entry' AND ${t.originEntryId} IS NOT NULL
             AND ${t.originLiabilityId} IS NULL AND ${t.originRecurrenceId} IS NULL)
          OR (${t.originKind} = 'BankAccount' AND ${t.originBankAccountId} IS NOT NULL
             AND ${t.originLiabilityId} IS NULL AND ${t.originRecurrenceId} IS NULL
             AND ${t.originEntryId} IS NULL)
          OR (${t.originKind} = 'Investment' AND ${t.originInvestmentId} IS NOT NULL
             AND ${t.originLiabilityId} IS NULL AND ${t.originRecurrenceId} IS NULL
             AND ${t.originEntryId} IS NULL)`,
    ),
  ],
)

/* -------------------------------------------------------------------------
 * Consumo Livre
 * ---------------------------------------------------------------------- */

/** One configuration per person, so `user_id` alone is the primary key. */
export const discretionarySpendingConfig = sqliteTable(
  'discretionary_spending_config',
  {
    userId: userId(),
    monthlyAmount: integer('monthly_amount').notNull(),
    sourceAccountId: text('source_account_id').notNull(),
    entity: text('entity', { enum: ENTITY }).notNull(),
    /** Valor fixo ou saldo da conta de origem (2026-09-29). */
    allowanceKind: text('allowance_kind', { enum: ['Fixed', 'SourceBalance'] })
      .notNull()
      .default('Fixed'),
  },
  (t) => [
    primaryKey({ columns: [t.userId] }),
    foreignKey({
      columns: [t.userId, t.sourceAccountId],
      foreignColumns: [bankAccounts.userId, bankAccounts.id],
    }).onDelete('restrict'),
    check('discretionary_config_amount_non_negative', sql`${t.monthlyAmount} >= 0`),
  ],
)

/**
 * A "Gastei um valor". `entry_id` is the primary key because the widget creates a
 * REAL Lançamento and this row is the widget's view of it, carrying the one field
 * the Aba Despesa does not have (a Rótulo).
 *
 * The Rótulo is conceptually a field of the Lançamento — Figma Wireframe note
 * `164:5`, text `164:7`: "Rótulo existe só nas abas que não têm campo de
 * Categoria (Consumo Livre e IR)" — and the 1:1 primary key `(user_id,
 * entry_id)` is what says so here: the row cannot exist without its Lançamento
 * and there can never be two of them.
 *
 * It is NOT the `entries.label` column, and that is the same rule enforced from
 * the other side: `entries_expense_revenue_shape` requires `label IS NULL` for
 * every Expense and Revenue, which is `164:7`'s second sentence written as a
 * CHECK ("Despesa, Receita e Pró-labore/Distribuição já têm Categoria, então
 * Rótulo seria redundante ali"). A gasto de Consumo Livre IS an Expense row, so
 * widening that CHECK to fit its Rótulo would let every Despesa carry one.
 *
 * This table also carries a second job that keeps it here regardless: it is the
 * membership marker of the widget. `listByMonth`
 * (discretionary-spending.repository.ts) selects FROM it and joins `entries` —
 * it is how the app knows which Lançamentos the widget created.
 */
export const discretionaryExpenses = sqliteTable(
  'discretionary_expenses',
  {
    userId: userId(),
    entryId: text('entry_id').notNull(),
    label: text('label'),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.entryId] }),
    foreignKey({
      columns: [t.userId, t.entryId],
      foreignColumns: [entries.userId, entries.id],
    }).onDelete('restrict'),
  ],
)

/* -------------------------------------------------------------------------
 * Onboarding
 * ---------------------------------------------------------------------- */

/**
 * O progresso do wizard — uma linha por pessoa, então `user_id` sozinho é a
 * chave primária, igual a `discretionary_spending_config`.
 *
 * Tabela própria, e não uma coluna em `users`: o comentário de `users` acima
 * é explícito em que aquela tabela guarda só o id opaco (minimização,
 * ADR-0009 §4), e progresso de fluxo não é identidade. Separada, ela também
 * some inteira quando o fluxo mudar, sem migração sobre a tabela da qual toda
 * chave estrangeira do banco pende.
 *
 * `last_step` é anulável porque "Fazer depois" (Figma 116:11) é clicado no
 * Onboarding 0, a única tela do fluxo que o Wireframe (116:2) desenha sem a
 * barra de cinco segmentos — não há passo nenhum a registrar ali.
 */
/**
 * P21 — o retrato do Patrimônio Líquido no fim de cada mês em que ele mudou.
 *
 * Existe porque o Balanço Patrimonial não tem histórico e não pode ganhar um
 * por derivação: `bank_accounts.balance` e `investments.accumulated_value` só
 * mudam quando a pessoa os edita (medido em 2026-09-09 — pagar um Lançamento
 * não move saldo nenhum). Sem esta tabela, a Evolução Mensal desenhava o PL de
 * meses passados por uma reconstrução que assumia que só o Lucro Líquido o
 * movia, o que é falso pela mesma medição.
 *
 * Uma linha por (mês, visão), sobrescrita a cada mudança de patrimônio dentro
 * do mesmo mês: o que interessa é a ÚLTIMA do mês, que é o fechamento. Mês sem
 * linha é mês em que nada mudou, e por isso herda o anterior — também exato.
 *
 * Sem chave estrangeira para conta, investimento ou passivo de propósito: o
 * retrato é um valor agregado de um instante, e apagar a conta que o originou
 * não torna o retrato falso.
 */
export const netWorthSnapshots = sqliteTable(
  'net_worth_snapshots',
  {
    userId: userId(),
    /** `YYYY-MM`. */
    month: text('month').notNull(),
    view: text('view', { enum: VIEWS }).notNull(),
    netWorth: integer('net_worth').notNull(),
    // P22: o total investido no mesmo retrato — ver NetWorthSnapshot.
    investmentsTotal: integer('investments_total').notNull().default(0),
    /** A data em que este retrato foi tirado — a tela ainda não a usa. */
    recordedOn: text('recorded_on').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.month, t.view] }),
    foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete('restrict'),
  ],
)

export const onboardingProgress = sqliteTable(
  'onboarding_progress',
  {
    userId: userId(),
    status: text('status', { enum: ONBOARDING_STATUS }).notNull(),
    lastStep: integer('last_step'),
  },
  (t) => [
    primaryKey({ columns: [t.userId] }),
    foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete('restrict'),
    check(
      'onboarding_last_step_in_range',
      sql`${t.lastStep} IS NULL OR (${t.lastStep} >= 1 AND ${t.lastStep} <= 5)`,
    ),
  ],
)

/* -------------------------------------------------------------------------
 * Open Finance (ADR-0020)
 * ---------------------------------------------------------------------- */

/**
 * Which provider account points at which position. One table instead of a
 * column on each of the three positions because a card is not a position of
 * its own (it points at the account that pays it) and the three kinds share
 * every other field.
 *
 * `provider_account_id` is the provider's opaque id — never logged
 * (ADR-0020 §7). The two foreign keys CASCADE, unlike the RESTRICT of the rest
 * of the schema (ADR-0012 §2): the link is an attribute of the position, not a
 * history of it, and "Descartar" a Conta Bancária must not answer 409 because
 * it was once linked.
 */
export const openFinanceLinks = sqliteTable(
  'open_finance_links',
  {
    userId: userId(),
    providerAccountId: text('provider_account_id').notNull(),
    targetKind: text('target_kind', {
      enum: ['BankAccount', 'CreditCard', 'Investment'],
    }).notNull(),
    targetBankAccountId: text('target_bank_account_id'),
    targetInvestmentId: text('target_investment_id'),
    linkedOn: text('linked_on').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.providerAccountId] }),
    foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete('restrict'),
    foreignKey({
      columns: [t.userId, t.targetBankAccountId],
      foreignColumns: [bankAccounts.userId, bankAccounts.id],
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.userId, t.targetInvestmentId],
      foreignColumns: [investments.userId, investments.id],
    }).onDelete('cascade'),
    check(
      'open_finance_links_target_shape',
      sql`(${t.targetKind} = 'Investment' AND ${t.targetInvestmentId} IS NOT NULL AND ${t.targetBankAccountId} IS NULL) OR (${t.targetKind} <> 'Investment' AND ${t.targetBankAccountId} IS NOT NULL AND ${t.targetInvestmentId} IS NULL)`,
    ),
  ],
)

/**
 * One row per provider transaction ever read — the idempotency key of the
 * import (ADR-0020 §2) and the only place the bank's description is kept.
 *
 * `entry_id` has no foreign key on purpose. SQLite's `SET NULL` on a composite
 * key would null `user_id` too, and RESTRICT would stop the person from
 * discarding an imported Lançamento — the row must survive the discard (or the
 * next sync would import the transaction again), so the reader joins `entries`
 * instead of trusting the column.
 *
 * `description` is text written by the bank about the person's spending: it
 * is shown on screen and must never reach `src/lib/log.ts` (ADR-0009 §3).
 */
export const importedTransactions = sqliteTable(
  'imported_transactions',
  {
    userId: userId(),
    transactionId: text('transaction_id').notNull(),
    accountId: text('account_id').notNull(),
    date: text('date').notNull(),
    amount: integer('amount').notNull(),
    description: text('description').notNull(),
    outcome: text('outcome', {
      enum: [
        'DiscretionaryExpense',
        'PayPlanned',
        'Transfer',
        'TransferCounterpart',
        'CardPurchase',
        'CardBillPayment',
        'Entry',
        'Ignored',
      ],
    }).notNull(),
    entryId: text('entry_id'),
    settledOn: text('settled_on'),
    /** Card purchases: the provider's bill id — only that bill's payment settles it. */
    billId: text('bill_id'),
    /**
     * Card purchases: imported while the bank still held it in the open bill
     * (2026-10-01). Each sync follows it until it posts, changes or vanishes.
     */
    pending: integer('pending', { mode: 'boolean' }).notNull().default(false),
    /** The provider's category, shown as detail. It does not choose a category (PRD v7.46). */
    providerCategory: text('provider_category'),
    /**
     * The person changed the category of the Lançamento this created. "Reimportar"
     * keeps these: redoing them would throw away the person's work.
     */
    categorizedByPerson: integer('categorized_by_person', { mode: 'boolean' })
      .notNull()
      .default(false),
    /**
     * Transferência only (2026-09-29): `Unclassified` between entities until
     * the person picks Pró-labore, Distribuição, Aporte na PJ or Só
     * transferência; `Transfer` straight away within one entity. With the two
     * Contas Bancárias it moved between, read at import time — a link changed
     * later must not rewrite what the money did.
     */
    transferKind: text('transfer_kind', {
      enum: ['Unclassified', 'ProLabore', 'ProfitDistribution', 'CapitalContribution', 'Transfer'],
    }),
    counterpartTransactionId: text('counterpart_transaction_id'),
    fromBankAccountId: text('from_bank_account_id'),
    toBankAccountId: text('to_bank_account_id'),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.transactionId] }),
    foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete('restrict'),
    index('imported_transactions_user_outcome_idx').on(t.userId, t.outcome, t.settledOn),
    check('imported_transactions_amount_non_negative', sql`${t.amount} >= 0`),
  ],
)

export const openFinanceSyncState = sqliteTable(
  'open_finance_sync_state',
  {
    userId: userId(),
    lastSyncedAt: text('last_synced_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId] }),
    foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete('restrict'),
  ],
)

/**
 * The person's Open Finance preferences (2026-10-01). No row means the
 * defaults: automatic sync on, as it was before the switch existed.
 */
export const openFinanceSettings = sqliteTable(
  'open_finance_settings',
  {
    userId: userId(),
    /** Sync when the app opens (PRD P53). "Sincronizar agora" works either way. */
    autoSync: integer('auto_sync', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [
    primaryKey({ columns: [t.userId] }),
    foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete('restrict'),
  ],
)

/** Every table, for the migration runner and for tests that truncate. */
export const schema = {
  users,
  statementBlocks,
  categories,
  bankAccounts,
  tangibleAssets,
  investments,
  liabilities,
  installments,
  rateAdjustments,
  recurrences,
  entries,
  occurrences,
  profitAllocations,
  allocationItems,
  pendingAllocations,
  paymentDiscrepancies,
  traceEvents,
  netWorthSnapshots,
  discretionarySpendingConfig,
  discretionaryExpenses,
  onboardingProgress,
  openFinanceLinks,
  importedTransactions,
  openFinanceSyncState,
  openFinanceSettings,
}
