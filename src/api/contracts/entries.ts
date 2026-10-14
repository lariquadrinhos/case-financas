/**
 * Lançamento — `/api/v1/entries`.
 *
 * The five tabs of Novo Lançamento (files_design/03) are ONE resource
 * discriminated by `kind`, exactly as the domain models it: an entry is one
 * transaction with the entity as an attribute, never a record duplicated per
 * entity (PRD §5). The per-kind field lists below are transcribed from
 * files_design/03, tab by tab.
 */

import { OVERPAYMENT_CHOICES } from '@/domain/entries'
import { registry, z } from '@/api/registry'
import { API_BASE_PATH } from '@/api/http'
import {
  centsSchema,
  classificationSchema,
  entityWithDefault,
  entryStatusSchema,
  errorResponses,
  idParams,
  idSchema,
  incomeTaxDirectionSchema,
  isoDateSchema,
  labelSchema,
  listEnvelope,
  monthSchema,
  nonNegativeCentsSchema,
  paginationQuery,
  recurrenceAmountKindSchema,
  viewSchema,
} from './common'

/* -------------------------------------------------------------------------
 * Response
 * ---------------------------------------------------------------------- */

const entryBase = {
  id: idSchema,
  amount: centsSchema,
  /** The single date that decides the accounting month — cash basis (PRD §5). */
  date: isoDateSchema,
  status: entryStatusSchema,
  /** Set when the entry was born from a recurrence occurrence. */
  recurrenceId: idSchema.nullable(),
  /** "Descrição" — free text; absent when none was given. */
  description: z.string().nullable().optional(),
  /**
   * A transação do Open Finance que é a testemunha deste lançamento — importada
   * ou ligada por "Vincular ao banco" (2026-10-09). Ausente quando não há.
   */
  linkedToBank: z.boolean().optional(),
}

const expenseEntrySchema = z.object({
  ...entryBase,
  kind: z.literal('Expense'),
  entity: z.enum(['PF', 'PJ']),
  categoryId: idSchema,
  classification: classificationSchema,
  bankAccountId: idSchema,
  /** "Cartão de crédito" (ADR-0021); absent means not a card. */
  isCreditCard: z.boolean().optional(),
  /** "Contabilizar em" (ADR-0021); absent or null means the payment month. */
  accountingMonth: monthSchema.nullable().optional(),
})

const revenueEntrySchema = z.object({
  ...entryBase,
  kind: z.literal('Revenue'),
  entity: z.enum(['PF', 'PJ']),
  categoryId: idSchema,
  classification: classificationSchema,
  bankAccountId: idSchema /** "Cartão de crédito" — um estorno no cartão (2026-10-09). */,
  isCreditCard: z.boolean().optional(),
})

/** Pró-labore is always PJ → PF and has no `entity`; the PJ source is optional (ADR-0018). */
const proLaboreEntrySchema = z.object({
  ...entryBase,
  kind: z.literal('ProLabore'),
  sourceAccountId: idSchema.nullable(),
  destinationAccountId: idSchema,
})

const profitDistributionEntrySchema = z.object({
  ...entryBase,
  kind: z.literal('ProfitDistribution'),
  sourceAccountId: idSchema.nullable(),
  destinationAccountId: idSchema,
})

/** IR has no Categoria, which is exactly why it keeps a Rótulo (files_design/03). */
const incomeTaxEntrySchema = z.object({
  ...entryBase,
  kind: z.literal('IncomeTax'),
  direction: incomeTaxDirectionSchema,
  entity: z.enum(['PF', 'PJ']),
  bankAccountId: idSchema,
  label: labelSchema,
})

export const entrySchema = registry.register(
  'Entry',
  z.discriminatedUnion('kind', [
    expenseEntrySchema,
    revenueEntrySchema,
    proLaboreEntrySchema,
    profitDistributionEntrySchema,
    incomeTaxEntrySchema,
  ]),
)

export const entryListSchema = registry.register('EntryList', listEnvelope(entrySchema))

/* -------------------------------------------------------------------------
 * Recorrência inside the form (files_design/03 "Objeto Recorrência")
 * ---------------------------------------------------------------------- */

/**
 * The recurrence toggle of the Novo Lançamento form. `null` is the toggle off,
 * which is the default on every tab — "Ativa: booleano, default falso".
 *
 * `endsOn` is `null` when the "Definir data de término" toggle is off. On the IR
 * tab that toggle ships ON, but that is a screen default, not a server rule
 * (files_design/03 "Aba IR": "Exceção de default").
 */
export const entryRecurrenceSchema = z.strictObject({
  amountKind: recurrenceAmountKindSchema.default('Fixed'),
  endsOn: isoDateSchema.nullable().default(null),
})

/* -------------------------------------------------------------------------
 * Create
 * ---------------------------------------------------------------------- */

const newEntryCommon = {
  /**
   * Never negative. The sign of a Lançamento is carried by its `kind` (an
   * Expense already subtracts, `src/domain/entries/projection.ts`) and by
   * `direction` on IR, so a negative amount is a despesa disguised as a
   * receita — the "erro de dado" PRD §5 says must be reported and never drawn.
   * `markAsPaid` already refuses one (`entries.negative_paid_amount`); creating
   * one must not be easier than paying one.
   */
  amount: nonNegativeCentsSchema,
  date: isoDateSchema,
  /** Toggle with a pre-selected value: "Pago" on Despesa, "Recebido" on Receita. */
  status: entryStatusSchema.default('Paid'),
  recurrence: entryRecurrenceSchema.nullable().default(null),
  /**
   * "Descrição (opcional)" — o que o lançamento foi, em texto livre
   * (2026-09-29). 200 caracteres: cabe a descrição que o banco manda.
   */
  description: z.string().trim().max(200).nullable().optional(),
}

const newExpenseSchema = z.strictObject({
  ...newEntryCommon,
  kind: z.literal('Expense'),
  entity: entityWithDefault,
  categoryId: idSchema,
  /** Suggested from the category and editable — never empty (files_design/01 §5.6). */
  classification: classificationSchema.default('Current'),
  bankAccountId: idSchema,
  /** "Cartão de crédito" — Despesa only, default off (ADR-0021). */
  isCreditCard: z.boolean().default(false),
  /**
   * "Contabilizar em" — Despesa only (ADR-0021). `null`, the default, is the
   * payment month (PRD §5).
   */
  accountingMonth: monthSchema.nullable().default(null),
})

const newRevenueSchema = z.strictObject({
  ...newEntryCommon,
  kind: z.literal('Revenue'),
  entity: entityWithDefault,
  categoryId: idSchema,
  classification: classificationSchema.default('Current'),
  bankAccountId:
    idSchema /** "Cartão de crédito" — um estorno no cartão (2026-10-09). Sem "Contabilizar em". */,
  isCreditCard: z.boolean().default(false),
})

const newProLaboreSchema = z.strictObject({
  ...newEntryCommon,
  kind: z.literal('ProLabore'),
  // ADR-0018: omitido ou null quando o dinheiro não sai de conta PJ cadastrada.
  sourceAccountId: idSchema.nullable().default(null),
  destinationAccountId: idSchema,
})

const newProfitDistributionSchema = z.strictObject({
  ...newEntryCommon,
  kind: z.literal('ProfitDistribution'),
  sourceAccountId: idSchema.nullable().default(null),
  destinationAccountId: idSchema,
})

const newIncomeTaxSchema = z.strictObject({
  ...newEntryCommon,
  kind: z.literal('IncomeTax'),
  direction: incomeTaxDirectionSchema,
  entity: entityWithDefault,
  bankAccountId: idSchema,
  /** Exception 1 of files_design/03: Rótulo is genuinely optional. */
  label: labelSchema.default(null),
})

/**
 * The per-kind create schemas, exported so the Recorrência contract can build
 * its template from the SAME field lists. Duplicating them there is how the two
 * models start to drift at the first new field (src/domain/README.md makes the
 * same argument for `RecurrenceTemplate`).
 */
export const newEntryVariants = {
  Expense: newExpenseSchema,
  Revenue: newRevenueSchema,
  ProLabore: newProLaboreSchema,
  ProfitDistribution: newProfitDistributionSchema,
  IncomeTax: newIncomeTaxSchema,
} as const

export const newEntrySchema = registry.register(
  'NewEntry',
  z.discriminatedUnion('kind', [
    newExpenseSchema,
    newRevenueSchema,
    newProLaboreSchema,
    newProfitDistributionSchema,
    newIncomeTaxSchema,
  ]),
)

/**
 * PATCH carries the same shape with every field but `kind` optional. `kind` stays
 * required because it selects WHICH shape is being patched — the API does not
 * accept changing an entry's natureza: a pró-labore that becomes a despesa is a
 * different transaction, deleted and re-created.
 */
/**
 * `DELETE /entries/{id}` — "Descartar lançamento". `closeRecurrence=true` also
 * does "Encerrar recorrência" from the entry's date, for an entry of a série.
 */
export const entryDeleteQuerySchema = z.strictObject({
  closeRecurrence: z.enum(['true', 'false']).default('false'),
})

/**
 * The create shape, every field optional and WITHOUT its default. Measured on
 * 2026-10-01: `.partial()` alone keeps each `.default()`, so a patch of
 * `{kind, categoryId}` — what the DRE sends to categorise — reached the
 * handler as `status: "Paid"`, `entity: "PF"`, `classification: "Current"`.
 * A Previsto card purchase became Pago when categorised, and a PJ expense PF.
 * A default is the create form's pre-selection; a field absent from a patch
 * means "unchanged".
 */
function patchOf<S extends z.ZodObject>(schema: S) {
  const undefaulted = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => [
      key,
      field instanceof z.ZodDefault ? field.unwrap() : field,
    ]),
  ) as S['shape']
  return schema.extend(undefaulted).partial()
}

export const entryPatchSchema = registry.register(
  'EntryPatch',
  z.discriminatedUnion('kind', [
    patchOf(newExpenseSchema).extend({ kind: z.literal('Expense') }),
    patchOf(newRevenueSchema).extend({ kind: z.literal('Revenue') }),
    patchOf(newProLaboreSchema).extend({ kind: z.literal('ProLabore') }),
    patchOf(newProfitDistributionSchema).extend({ kind: z.literal('ProfitDistribution') }),
    patchOf(newIncomeTaxSchema).extend({ kind: z.literal('IncomeTax') }),
  ]),
)

/* -------------------------------------------------------------------------
 * Marcar Pago
 * ---------------------------------------------------------------------- */

/**
 * files_design/03 "Marcar Pago". Both fields are required here even though the
 * screen pre-fills them (planned amount, today): the pre-fill is the form's, and
 * the server never reads a clock — the payment date is always the one the person
 * confirmed (PRD §5).
 */
export const markAsPaidSchema = registry.register(
  'MarkAsPaid',
  z.strictObject({
    paidAmount: centsSchema.min(0),
    paymentDate: isoDateSchema,
    /**
     * Only meaningful when the paid amount is ABOVE the planned one. Paying
     * below never becomes a choice: the shortfall becomes its own Pendência
     * (files_design/03).
     */
    overpaymentChoice: z.enum(OVERPAYMENT_CHOICES).optional(),
  }),
)

export const paymentOutcomeSchema = registry.register(
  'PaymentOutcome',
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('Exact') }),
    z.object({
      kind: z.literal('Underpaid'),
      shortfall: centsSchema,
      becomesPending: z.literal(true),
    }),
    z.object({
      kind: z.literal('Overpaid'),
      excess: centsSchema,
      becomesPending: z.literal(false),
    }),
  ]),
)

export const markAsPaidResultSchema = registry.register(
  'MarkAsPaidResult',
  z.object({ entry: entrySchema, outcome: paymentOutcomeSchema }),
)

/* -------------------------------------------------------------------------
 * Vincular ao banco (dono, 2026-10-09)
 * ---------------------------------------------------------------------- */

/** Uma transação que pode virar a testemunha do lançamento. */
export const bankLinkCandidateSchema = registry.register(
  'BankLinkCandidate',
  z.object({
    transactionId: z.string(),
    date: isoDateSchema,
    amount: centsSchema,
    /** O texto do banco. Nunca vai para log (ADR-0020 §7). */
    description: z.string(),
    providerCategory: z.string().nullable(),
  }),
)

export const bankLinkBodySchema = registry.register(
  'BankLink',
  z.strictObject({ transactionId: z.string().min(1) }),
)

/* -------------------------------------------------------------------------
 * Query — the seven filters of the Histórico (files_design/03)
 * ---------------------------------------------------------------------- */

export const entryQuerySchema = z.strictObject({
  status: entryStatusSchema.optional(),
  /** "Entidade" on the screen, but it accepts Consolidado — which is a View, not an Entity. */
  view: viewSchema.optional(),
  month: monthSchema.optional(),
  categoryId: idSchema.optional(),
  classification: classificationSchema.optional(),
  bankAccountId: idSchema.optional(),
  recurring: z.enum(['true', 'false']).optional(),
  ...paginationQuery.shape,
})

/* -------------------------------------------------------------------------
 * Routes
 * ---------------------------------------------------------------------- */

const TAG = 'Entries'
const path = `${API_BASE_PATH}/entries`

registry.registerPath({
  method: 'get',
  path,
  tags: [TAG],
  summary: 'Lista lançamentos, com os filtros do Histórico',
  request: { query: entryQuerySchema },
  responses: {
    200: {
      description: 'Lançamentos.',
      content: { 'application/json': { schema: entryListSchema } },
    },
    ...errorResponses(422),
  },
})

registry.registerPath({
  method: 'post',
  path,
  tags: [TAG],
  summary: 'Cria um lançamento',
  description:
    'ADR-0019: com `recurrence`, a série começa no mês do lançamento. Recorrente **Pago** grava o lançamento e a ocorrência do mês já paga, apontando para ele. Recorrente **Previsto** NÃO grava lançamento: responde com a **ocorrência** do mês (o corpo tem a forma de `Occurrence`) e `Location` aponta para `/api/v1/occurrences/{id}`.',
  request: {
    body: { content: { 'application/json': { schema: newEntrySchema } }, required: true },
  },
  responses: {
    201: {
      description:
        'Criado. `Location` aponta para o recurso — um lançamento, ou a ocorrência no caso recorrente Previsto (ADR-0019).',
      headers: z.object({ location: z.string() }),
      content: { 'application/json': { schema: entrySchema } },
    },
    ...errorResponses(400, 404, 422),
  },
})

registry.registerPath({
  method: 'get',
  path: `${path}/{id}`,
  tags: [TAG],
  summary: 'Lê um lançamento',
  request: { params: idParams },
  responses: {
    200: { description: 'Lançamento.', content: { 'application/json': { schema: entrySchema } } },
    ...errorResponses(404),
  },
})

registry.registerPath({
  method: 'patch',
  path: `${path}/{id}`,
  tags: [TAG],
  summary: 'Edita um lançamento',
  request: {
    params: idParams,
    body: { content: { 'application/json': { schema: entryPatchSchema } }, required: true },
  },
  responses: {
    200: {
      description: 'Lançamento atualizado.',
      content: { 'application/json': { schema: entrySchema } },
    },
    ...errorResponses(400, 404, 409, 422),
  },
})

registry.registerPath({
  method: 'delete',
  path: `${path}/{id}`,
  tags: [TAG],
  summary: 'Descarta um lançamento',
  description:
    'Se o lançamento é o pagamento de uma ocorrência de recorrência, a ocorrência daquele mês é descartada. `closeRecurrence=true` também encerra a série na data do lançamento.',
  request: { params: idParams, query: entryDeleteQuerySchema },
  responses: { 204: { description: 'Removido.' }, ...errorResponses(404, 409) },
})

registry.registerPath({
  method: 'post',
  path: `${path}/{id}/payment`,
  tags: [TAG],
  summary: 'Marca um lançamento como pago',
  description:
    'Pago abaixo do previsto vira uma Pendência própria; pago acima nunca vira Pendência ' +
    '(files_design/03 "Marcar Pago").',
  request: {
    params: idParams,
    body: { content: { 'application/json': { schema: markAsPaidSchema } }, required: true },
  },
  responses: {
    200: {
      description: 'Lançamento pago e o desfecho da divergência.',
      content: { 'application/json': { schema: markAsPaidResultSchema } },
    },
    ...errorResponses(400, 404, 409, 422),
  },
})

registry.registerPath({
  method: 'get',
  path: `${path}/{id}/bank-link`,
  tags: [TAG],
  summary: 'Transações do banco que podem ser ligadas a este lançamento',
  description:
    'As que viraram um lançamento próprio, numa conta do provedor vinculada à mesma Conta Bancária, no mesmo sentido e até 15 dias de distância. Mesmo valor primeiro.',
  request: { params: idParams },
  responses: {
    200: {
      description: 'Candidatas.',
      content: { 'application/json': { schema: listEnvelope(bankLinkCandidateSchema) } },
    },
    ...errorResponses(404),
  },
})

registry.registerPath({
  method: 'post',
  path: `${path}/{id}/bank-link`,
  tags: [TAG],
  summary: 'Liga o lançamento a uma transação do banco',
  description:
    'O lançamento recebe o valor e a data do banco e fica Pago; o lançamento que a transação tinha criado é apagado; a transação passa a apontar para este. Categoria e descrição continuam as da pessoa.',
  request: {
    params: idParams,
    body: { content: { 'application/json': { schema: bankLinkBodySchema } }, required: true },
  },
  responses: {
    200: {
      description: 'Lançamento vinculado.',
      content: { 'application/json': { schema: entrySchema } },
    },
    ...errorResponses(404, 422),
  },
})
