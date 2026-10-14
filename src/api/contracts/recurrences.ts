/**
 * Recorrência e Ocorrência — `/api/v1/recurrences` and `/api/v1/occurrences`.
 *
 * Two resources because they have two lifetimes: the série is the template the
 * person configures once, the ocorrência is the monthly instance the Revisão de
 * Recorrentes screen acts on (PRD §5, Event Storming Fluxo D).
 *
 * An occurrence is NEVER created by a client — the engine generates it. What a
 * client does is edit it, discard it for one month, or mark it paid.
 */

import { EDIT_SCOPES } from '@/domain/recurrence'
import { registry, z } from '@/api/registry'
import { API_BASE_PATH } from '@/api/http'
import { markAsPaidSchema, newEntryVariants } from './entries'
import {
  centsSchema,
  entryStatusSchema,
  errorResponses,
  idParams,
  idSchema,
  isoDateSchema,
  listEnvelope,
  monthSchema,
  nonNegativeCentsSchema,
  recurrenceAmountKindSchema,
} from './common'

/**
 * The entry data copied into every occurrence: the kind and its kind-specific
 * fields, WITHOUT the three that belong to a single month (date, status, the
 * recurrence link) and without the nested recurrence toggle.
 */
const withoutOccurrenceFields = { date: true, status: true, recurrence: true } as const

export const recurrenceTemplateSchema = registry.register(
  'RecurrenceTemplate',
  z.discriminatedUnion('kind', [
    // "Contabilizar em" is a single month too (ADR-0021): every occurrence
    // keeps its own. Only the Despesa has it, and `omit` refuses an absent key.
    newEntryVariants.Expense.omit({ ...withoutOccurrenceFields, accountingMonth: true }),
    newEntryVariants.Revenue.omit(withoutOccurrenceFields),
    newEntryVariants.ProLabore.omit(withoutOccurrenceFields),
    newEntryVariants.ProfitDistribution.omit(withoutOccurrenceFields),
    newEntryVariants.IncomeTax.omit(withoutOccurrenceFields),
  ]),
)

export const recurrenceSchema = registry.register(
  'Recurrence',
  z.object({
    id: idSchema,
    template: recurrenceTemplateSchema,
    amountKind: recurrenceAmountKindSchema,
    startDate: isoDateSchema,
    /** `null` is an open-ended series; a date covers a parcelamento of N months. */
    endsOn: isoDateSchema.nullable(),
    /** Set by "Encerrar recorrência" — different from discarding one month. */
    closedOn: isoDateSchema.nullable(),
  }),
)

export const newRecurrenceSchema = registry.register(
  'NewRecurrence',
  z.strictObject({
    template: recurrenceTemplateSchema,
    amountKind: recurrenceAmountKindSchema.default('Fixed'),
    startDate: isoDateSchema,
    endsOn: isoDateSchema.nullable().default(null),
  }),
)

export const occurrenceSchema = registry.register(
  'Occurrence',
  z.object({
    id: idSchema,
    recurrenceId: idSchema,
    month: monthSchema,
    plannedDate: isoDateSchema,
    /** `null` while a "a definir" series has not been filled in — it never blocks the month. */
    plannedAmount: centsSchema.nullable(),
    status: entryStatusSchema,
    /** "Descartar": skipped this month only; the series continues next month. */
    discarded: z.boolean(),
    entryId: idSchema.nullable(),
    /** "Só esta ocorrência": a Descrição deste mês, acima da da série (2026-10-01). */
    description: z.string().nullable().optional(),
  }),
)

/**
 * PRD UC14: editing one occurrence asks how far the change reaches. "Toda a
 * série (valores em aberto)" is status-based, not time-based — it reaches every
 * occurrence still Previsto, including a late one (files_design/02).
 *
 * Until 2026-10-01 only `amount` was editable, as Wireframe `34:2` card `34:24`
 * draws. The owner asked for the Descrição and the series' data too ("não
 * consigo atualizar todos os dados da recorrência, como categoria"), keeping
 * the choice of reach. `template` goes only with `WholeSeries`
 * (`recurrence.this_only_changes_amount_and_description`); "Tipo de valor" and
 * the término stay out — they are the RECORRÊNCIA block, and closing a series
 * is `/recurrences/{id}/closure`.
 */
export const occurrencePatchSchema = registry.register(
  'OccurrencePatch',
  z.strictObject({
    /** Same rule as a Lançamento's own `amount`: a valor previsto is never negative. */
    plannedAmount: nonNegativeCentsSchema,
    scope: z.enum(EDIT_SCOPES).default('ThisOnly'),
    /** "Descrição (opcional)", the same 200 characters as a Lançamento's. */
    description: z.string().trim().max(200).nullable().optional(),
    /** The series' data, same shape as at creation. `WholeSeries` only. */
    template: recurrenceTemplateSchema.optional(),
  }),
)

/** "Descartar" numa ocorrência: `true` também encerra a série no mês dela (2026-10-01). */
export const occurrenceDiscardQuerySchema = z.strictObject({
  closeRecurrence: z.enum(['true', 'false']).default('false'),
})

/** Exported so the route handler parses query strings with the SAME schema the spec documents. */
export const recurrenceListQuerySchema = z.strictObject({
  includeClosed: z.enum(['true', 'false']).default('false'),
})

export const occurrenceListQuerySchema = z.strictObject({
  month: monthSchema,
  includeDiscarded: z.enum(['true', 'false']).default('false'),
})

export const closeRecurrenceSchema = z.strictObject({ closedOn: isoDateSchema })

const TAG = 'Recurrences'
const recurrencesPath = `${API_BASE_PATH}/recurrences`
const occurrencesPath = `${API_BASE_PATH}/occurrences`
const json = (schema: z.ZodType) => ({ 'application/json': { schema } })

registry.registerPath({
  method: 'get',
  path: recurrencesPath,
  tags: [TAG],
  summary: 'Lista as séries de recorrência',
  request: { query: recurrenceListQuerySchema },
  responses: {
    200: { description: 'Séries.', content: json(listEnvelope(recurrenceSchema)) },
    ...errorResponses(422),
  },
})

registry.registerPath({
  method: 'post',
  path: recurrencesPath,
  tags: [TAG],
  summary: 'Cria uma série de recorrência',
  request: { body: { content: json(newRecurrenceSchema), required: true } },
  responses: {
    201: {
      description: 'Criada.',
      headers: z.object({ location: z.string() }),
      content: json(recurrenceSchema),
    },
    ...errorResponses(400, 404, 422),
  },
})

registry.registerPath({
  method: 'get',
  path: `${recurrencesPath}/{id}`,
  tags: [TAG],
  summary: 'Lê uma série',
  request: { params: idParams },
  responses: {
    200: { description: 'Série.', content: json(recurrenceSchema) },
    ...errorResponses(404),
  },
})

registry.registerPath({
  method: 'post',
  path: `${recurrencesPath}/{id}/closure`,
  tags: [TAG],
  summary: 'Encerra a série para sempre',
  description: 'Diferente de "Descartar", que pula um único mês (files_design/04).',
  request: {
    params: idParams,
    body: { content: json(closeRecurrenceSchema), required: true },
  },
  responses: {
    200: { description: 'Série encerrada.', content: json(recurrenceSchema) },
    ...errorResponses(400, 404, 409, 422),
  },
})

registry.registerPath({
  method: 'get',
  path: occurrencesPath,
  tags: [TAG],
  summary: 'Lista as ocorrências de um mês (Revisão de Recorrentes)',
  request: { query: occurrenceListQuerySchema },
  responses: {
    200: { description: 'Ocorrências.', content: json(listEnvelope(occurrenceSchema)) },
    ...errorResponses(422),
  },
})

registry.registerPath({
  method: 'patch',
  path: `${occurrencesPath}/{id}`,
  tags: [TAG],
  summary: 'Edita o valor de uma ocorrência',
  request: {
    params: idParams,
    body: { content: json(occurrencePatchSchema), required: true },
  },
  responses: {
    200: {
      description: 'Ocorrências afetadas — uma com "ThisOnly", várias com "WholeSeries".',
      content: json(listEnvelope(occurrenceSchema)),
    },
    ...errorResponses(400, 404, 409, 422),
  },
})

registry.registerPath({
  method: 'post',
  path: `${occurrencesPath}/{id}/payment`,
  tags: [TAG],
  summary: 'Marca uma ocorrência como paga',
  description: 'Cria o Lançamento correspondente, com a data de pagamento informada.',
  request: { params: idParams, body: { content: json(markAsPaidSchema), required: true } },
  responses: {
    200: { description: 'Ocorrência paga.', content: json(occurrenceSchema) },
    ...errorResponses(400, 404, 409, 422),
  },
})

registry.registerPath({
  method: 'get',
  path: `${occurrencesPath}/{id}`,
  tags: [TAG],
  summary: 'Lê uma ocorrência',
  request: { params: idParams },
  responses: {
    200: { description: 'A ocorrência.', content: json(occurrenceSchema) },
    ...errorResponses(404),
  },
})

registry.registerPath({
  method: 'post',
  path: `${occurrencesPath}/{id}/discard`,
  tags: [TAG],
  summary: 'Descarta a ocorrência deste mês',
  description:
    'Pula só este mês; a série continua. Com `closeRecurrence=true`, também encerra a série na data deste mês ("a série completa").',
  request: { params: idParams, query: occurrenceDiscardQuerySchema },
  responses: {
    200: { description: 'Ocorrência descartada.', content: json(occurrenceSchema) },
    ...errorResponses(404, 409),
  },
})
