/**
 * Consumo Livre — `/api/v1/discretionary-spending`.
 *
 * The widget, not a tab of Novo Lançamento (files_design/03). Two sub-resources:
 * the configuration (one per person, so `PUT` on a singleton path) and the
 * expenses.
 *
 * An expense posts to the fixed system category "Consumo Livre" inside Despesas
 * Pessoais; the date is today, the account and the entity come from the config,
 * so the popover asks for the amount only.
 */

import { DISCRETIONARY_ALLOWANCE_KINDS } from '@/domain/discretionary-spending'
import { registry, z } from '@/api/registry'
import { API_BASE_PATH } from '@/api/http'
import {
  centsSchema,
  entitySchema,
  entityWithDefault,
  errorResponses,
  idParams,
  idSchema,
  isoDateSchema,
  labelSchema,
  listEnvelope,
  monthSchema,
  nonNegativeCentsSchema,
} from './common'

export const discretionarySpendingConfigSchema = registry.register(
  'DiscretionarySpendingConfig',
  z.object({
    /** "Valor mensal" — the allowance, refilled on the 1st (files_design/01 §4a). */
    monthlyAmount: centsSchema,
    sourceAccountId: idSchema,
    entity: entitySchema,
    /** Valor fixo ou saldo da conta de origem (2026-09-29). */
    allowanceKind: z.enum(DISCRETIONARY_ALLOWANCE_KINDS).optional(),
  }),
)

export const discretionarySpendingConfigPutSchema = registry.register(
  'DiscretionarySpendingConfigPut',
  z.strictObject({
    monthlyAmount: centsSchema.min(0),
    sourceAccountId: idSchema,
    /** Inherited by every expense of the widget; the form's default is PF (files_design/03). */
    entity: entityWithDefault,
    /** Omitido = valor fixo, como toda configuração anterior a este campo. */
    allowanceKind: z.enum(DISCRETIONARY_ALLOWANCE_KINDS).default('Fixed'),
  }),
)

export const discretionaryExpenseSchema = registry.register(
  'DiscretionaryExpense',
  z.object({
    /** An `EntryId`: the widget creates a real Lançamento (src/domain/discretionary-spending). */
    id: idSchema,
    date: isoDateSchema,
    amount: nonNegativeCentsSchema,
    label: labelSchema,
  }),
)

/**
 * The popover asks for the amount only. The date is "hoje" on the SCREEN, and
 * the screen is what sends it: a pure server never reads a clock, and the
 * accounting month of the resulting Lançamento is the date the person confirmed
 * (PRD §5).
 */
export const newDiscretionaryExpenseSchema = registry.register(
  'NewDiscretionaryExpense',
  z.strictObject({
    amount: nonNegativeCentsSchema,
    date: isoDateSchema,
    /**
     * Exception 1: Rótulo. Available here even though the Aba Despesa has none —
     * Figma Wireframe note `164:5`, text `164:7`: "Rótulo existe só nas abas que
     * não têm campo de Categoria (Consumo Livre e IR) […] Despesa, Receita e
     * Pró-labore/Distribuição já têm Categoria, então Rótulo seria redundante
     * ali." It is a field of the Lançamento, in the place Categoria would take.
     *
     * Defaults to `null` because the popover asks for the amount only
     * (`345:1258`); the Rótulo is typed later, from the history row's "Editar".
     */
    label: labelSchema.default(null),
  }),
)

export const discretionaryExpensePatchSchema = registry.register(
  'DiscretionaryExpensePatch',
  z.strictObject({
    amount: nonNegativeCentsSchema.optional(),
    label: labelSchema.optional(),
  }),
)

const TAG = 'Discretionary spending'
const base = `${API_BASE_PATH}/discretionary-spending`
const json = (schema: z.ZodType) => ({ 'application/json': { schema } })

registry.registerPath({
  method: 'get',
  path: `${base}/config`,
  tags: [TAG],
  summary: 'Lê a configuração do Consumo Livre',
  responses: {
    200: { description: 'Configuração.', content: json(discretionarySpendingConfigSchema) },
    ...errorResponses(404),
  },
})

registry.registerPath({
  method: 'put',
  path: `${base}/config`,
  tags: [TAG],
  summary: 'Grava a configuração do Consumo Livre',
  request: { body: { content: json(discretionarySpendingConfigPutSchema), required: true } },
  responses: {
    200: { description: 'Configuração gravada.', content: json(discretionarySpendingConfigSchema) },
    ...errorResponses(400, 404, 422),
  },
})

registry.registerPath({
  method: 'get',
  path: `${base}/expenses`,
  tags: [TAG],
  summary: 'Lista os gastos de Consumo Livre de um mês',
  request: { query: z.strictObject({ month: monthSchema }) },
  responses: {
    200: { description: 'Gastos.', content: json(listEnvelope(discretionaryExpenseSchema)) },
    ...errorResponses(422),
  },
})

registry.registerPath({
  method: 'post',
  path: `${base}/expenses`,
  tags: [TAG],
  summary: 'Registra um gasto ("Gastei um valor")',
  request: { body: { content: json(newDiscretionaryExpenseSchema), required: true } },
  responses: {
    201: {
      description: 'Gasto registrado.',
      headers: z.object({ location: z.string() }),
      content: json(discretionaryExpenseSchema),
    },
    ...errorResponses(400, 404, 422),
  },
})

registry.registerPath({
  method: 'patch',
  path: `${base}/expenses/{id}`,
  tags: [TAG],
  summary: 'Edita um gasto a partir do histórico do widget',
  request: {
    params: idParams,
    body: { content: json(discretionaryExpensePatchSchema), required: true },
  },
  responses: {
    200: { description: 'Gasto atualizado.', content: json(discretionaryExpenseSchema) },
    ...errorResponses(400, 404, 422),
  },
})

registry.registerPath({
  method: 'delete',
  path: `${base}/expenses/{id}`,
  tags: [TAG],
  summary: 'Remove um gasto',
  request: { params: idParams },
  responses: { 204: { description: 'Removido.' }, ...errorResponses(404) },
})
