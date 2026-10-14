/**
 * The primitives every resource contract is built from.
 *
 * Field rules come literally from `files_design/03-modelo-de-dados-por-tela.md`.
 * Its "Convenção geral" is the default of this whole layer: **a field is
 * required unless it is one of the three documented exceptions** — Rótulo where
 * it exists, the direcionamento/alocação fields (an empty one becomes a
 * Pendência, never a validation failure), and toggles/selectors that carry a
 * pre-selected value. `files_design/01 §5.6` adds the half that matters here:
 * those toggles "nunca ficam vazios de qualquer forma", so at the boundary they
 * are optional-WITH-A-DEFAULT, never optional-and-absent.
 *
 * Every object is `.strict()`: an unknown key is rejected, not ignored. A
 * silently dropped field is how a client ends up believing it saved something
 * the server never stored.
 */

import {
  CLASSIFICATIONS,
  ENTITIES,
  ENTRY_KINDS,
  ENTRY_STATUSES,
  INCOME_TAX_DIRECTIONS,
  RECURRENCE_AMOUNT_KINDS,
  VIEWS,
  isoDate,
  month,
} from '@/domain/core'
import { registry, z } from '@/api/registry'
import { API_BASE_PATH, STATUS } from '@/api/http'

/* -------------------------------------------------------------------------
 * Scalars
 * ---------------------------------------------------------------------- */

/**
 * Money on the wire is an INTEGER of cents (ADR-0001 §5). A float of reais is
 * refused rather than rounded: `0.1 + 0.2 !== 0.3`, and a cent of drift per sum
 * is a visible divergence when the DRE is reconciled against the Balanço.
 */
export const centsSchema = z
  .number()
  .int()
  .openapi({ description: 'Valor monetário em centavos (inteiro). 152000 = R$ 1.520,00.' })

/** Amounts that a screen can never make negative — e.g. Consumo Livre (PRD §1). */
export const nonNegativeCentsSchema = centsSchema.min(0)

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MONTH_PATTERN = /^\d{4}-\d{2}$/

function isRealDate(value: string): boolean {
  try {
    isoDate(value)
    return true
  } catch {
    return false
  }
}

function isRealMonth(value: string): boolean {
  try {
    month(value)
    return true
  } catch {
    return false
  }
}

/**
 * "YYYY-MM-DD", no clock and no timezone. The shape is checked here and the
 * EXISTENCE of the day is checked by the domain constructor: the 30th of
 * February matches the pattern and is not a date.
 */
export const isoDateSchema = z
  .string()
  .regex(DATE_PATTERN)
  .refine(isRealDate, { error: 'nonexistent_date' })
  .openapi({
    description: 'Data no formato YYYY-MM-DD, sem hora e sem fuso.',
    example: '2026-07-20',
  })

export const monthSchema = z
  .string()
  .regex(MONTH_PATTERN)
  .refine(isRealMonth, { error: 'invalid_month' })
  .openapi({ description: 'Mês no formato YYYY-MM.', example: '2026-07' })

/** An opaque identifier. The API never promises a format; only that it round-trips. */
export const idSchema = z.string().min(1).max(64)

/** Free text the person typed: a name, a legenda, a creditor. Always trimmed, never empty. */
export const shortTextSchema = z.string().trim().min(1).max(120)

/**
 * "Rótulo" — exception 1 of files_design/03. It exists only on IR and on a
 * Consumo Livre expense, and it is genuinely optional there: `null` is a value,
 * not a missing field.
 */
export const labelSchema = z.string().trim().max(120).nullable()

/** A monthly interest rate as a decimal fraction: 0.0085 is the 0,85% a.m. the screen shows. */
export const monthlyRateSchema = z
  .number()
  .min(0)
  .max(1)
  .openapi({ description: 'Taxa mensal como fração decimal: 0.0085 = 0,85% a.m.', example: 0.0085 })

export const positiveIntSchema = z.number().int().min(1)
export const nonNegativeIntSchema = z.number().int().min(0)

/* -------------------------------------------------------------------------
 * Enums — one per closed vocabulary of src/domain/core
 * ---------------------------------------------------------------------- */

export const entitySchema = z.enum(ENTITIES)
export const viewSchema = z.enum(VIEWS)
export const entryStatusSchema = z.enum(ENTRY_STATUSES)
export const entryKindSchema = z.enum(ENTRY_KINDS)
export const classificationSchema = z.enum(CLASSIFICATIONS)
export const incomeTaxDirectionSchema = z.enum(INCOME_TAX_DIRECTIONS)
export const recurrenceAmountKindSchema = z.enum(RECURRENCE_AMOUNT_KINDS)

/**
 * Exception 3 of files_design/03: a toggle with a pre-selected value. The
 * default is applied HERE so the same rule holds for the API and the screen —
 * `files_design/03 "Aba Despesa"` gives Entidade PF and Status Pago.
 *
 * PF é o default decidido (P20, produto, 2026-09-09). A contradição não era
 * entre dois documentos e sim DENTRO do `files_design/03`, cuja convenção do
 * topo já listava Entidade entre os seletores com valor pré-selecionado
 * enquanto cinco linhas das tabelas escreviam "Default: vazio" — essas cinco
 * foram corrigidas. O código já fazia isto; o que mudou foi o documento parar
 * de dizer o contrário.
 */
export const entityWithDefault = entitySchema.default('PF')

/* -------------------------------------------------------------------------
 * Query conventions
 * ---------------------------------------------------------------------- */

/**
 * A query string is always text. `z.coerce` is used ONLY here, at the query
 * boundary — a JSON body carries real numbers and coercing there would silently
 * accept `"1520"` where an integer of cents is required.
 */
export const paginationQuery = z.strictObject({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export const booleanQuery = z.enum(['true', 'false']).transform((v) => v === 'true')

/* -------------------------------------------------------------------------
 * Envelopes
 * ---------------------------------------------------------------------- */

/**
 * `{ data, meta: { total } }` for every collection; a single resource is
 * returned bare. `total` counts the rows BEFORE `limit`/`offset`.
 */
export function listEnvelope<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    meta: z.object({ total: z.number().int().min(0) }),
  })
}

/* -------------------------------------------------------------------------
 * The problem document — RFC 9457
 * ---------------------------------------------------------------------- */

export const problemFieldErrorSchema = z
  .object({
    field: z.string(),
    code: z.string(),
  })
  .openapi('ProblemFieldError')

export const problemSchema = registry.register(
  'Problem',
  z.object({
    type: z.string().openapi({ example: 'urn:bigorna:problem:entries.negative_paid_amount' }),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    instance: z.string(),
    code: z.string().openapi({ description: 'Código legível por máquina, snake_case.' }),
    errors: z.array(problemFieldErrorSchema).optional(),
  }),
)

const problemContent = { 'application/problem+json': { schema: problemSchema } }

const RESPONSE_DESCRIPTIONS: Record<number, string> = {
  [STATUS.badRequest]: 'Corpo malformado (não é JSON).',
  [STATUS.unauthorized]: 'Sem sessão.',
  [STATUS.notFound]: 'Recurso inexistente para este usuário.',
  [STATUS.conflict]: 'Conflito com o estado atual do recurso.',
  [STATUS.unprocessable]: 'Requisição semanticamente inválida.',
  [STATUS.internal]: 'Erro inesperado.',
}

/**
 * The error responses every operation declares. 401 and 500 are on EVERY
 * endpoint because `handler()` can always produce them; the rest are opt-in per
 * operation so the document says what can really happen.
 */
export function errorResponses(...extra: readonly number[]) {
  const codes = [STATUS.unauthorized, STATUS.internal, ...extra]
  return Object.fromEntries(
    codes.map((status) => [
      String(status),
      { description: RESPONSE_DESCRIPTIONS[status] ?? 'Erro.', content: problemContent },
    ]),
  )
}

/** Path parameter shared by every `/{id}` route. */
export const idParams = z.strictObject({ id: idSchema })

/* -------------------------------------------------------------------------
 * The five standard operations of a resource
 * ---------------------------------------------------------------------- */

export interface ResourceRoutes {
  readonly tag: string
  /** Plural noun, no leading slash: `entries`, `bank-accounts`. */
  readonly resource: string
  /** pt-BR, singular, for the summaries: "conta bancária". */
  readonly singular: string
  readonly item: z.ZodType
  readonly create?: z.ZodType
  readonly patch?: z.ZodType
  readonly query?: z.ZodObject
  /**
   * A resource is deletable only when deleting is what the product actually
   * does. It is `false` wherever the record is history: a Lançamento is a
   * record, not a detail, and a Categoria is archived instead (files_design/01
   * §3.1).
   */
  readonly deletable?: boolean
}

/**
 * Registers list/create/read/patch/delete for one resource with the SAME status
 * codes everywhere, so a new resource cannot invent a second style. Anything
 * beyond the five (an action sub-resource such as `/payment`) is registered by
 * the resource's own file — adding one never edits this function (open/closed).
 */
export function registerResource(config: ResourceRoutes): void {
  const path = `${API_BASE_PATH}/${config.resource}`
  const json = (schema: z.ZodType) => ({ 'application/json': { schema } })

  registry.registerPath({
    method: 'get',
    path,
    tags: [config.tag],
    summary: `Lista ${config.singular}`,
    ...(config.query ? { request: { query: config.query } } : {}),
    responses: {
      200: { description: 'Lista.', content: json(listEnvelope(config.item)) },
      ...errorResponses(STATUS.unprocessable),
    },
  })

  if (config.create) {
    registry.registerPath({
      method: 'post',
      path,
      tags: [config.tag],
      summary: `Cria ${config.singular}`,
      request: { body: { content: json(config.create), required: true } },
      responses: {
        201: {
          description: 'Criado. `Location` aponta para o recurso.',
          headers: z.object({ location: z.string() }),
          content: json(config.item),
        },
        ...errorResponses(
          STATUS.badRequest,
          STATUS.notFound,
          STATUS.conflict,
          STATUS.unprocessable,
        ),
      },
    })
  }

  registry.registerPath({
    method: 'get',
    path: `${path}/{id}`,
    tags: [config.tag],
    summary: `Lê ${config.singular}`,
    request: { params: idParams },
    responses: {
      200: { description: 'Recurso.', content: json(config.item) },
      ...errorResponses(STATUS.notFound),
    },
  })

  if (config.patch) {
    registry.registerPath({
      method: 'patch',
      path: `${path}/{id}`,
      tags: [config.tag],
      summary: `Edita ${config.singular}`,
      request: { params: idParams, body: { content: json(config.patch), required: true } },
      responses: {
        200: { description: 'Recurso atualizado.', content: json(config.item) },
        ...errorResponses(
          STATUS.badRequest,
          STATUS.notFound,
          STATUS.conflict,
          STATUS.unprocessable,
        ),
      },
    })
  }

  if (config.deletable) {
    registry.registerPath({
      method: 'delete',
      path: `${path}/{id}`,
      tags: [config.tag],
      summary: `Remove ${config.singular}`,
      request: { params: idParams },
      responses: {
        204: { description: 'Removido.' },
        ...errorResponses(STATUS.notFound, STATUS.conflict),
      },
    })
  }
}
