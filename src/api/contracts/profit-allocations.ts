/**
 * Destinar o Lucro — `/api/v1/profit-allocations/{month}`.
 *
 * Addressed by MONTH, not by an id: there is exactly one allocation per month
 * (PRD UC6), so the month IS the identity and `PUT` is idempotent. It is also
 * the one place where the entity is deliberately absent — a single consolidated
 * decision about the combined result (files_design/02, "Princípios gerais").
 *
 * Every field of the four cards is optional: exception 2 of files_design/03.
 * Leaving part of the profit unallocated is what CREATES the Pendência on the
 * Home; it is never a validation failure.
 */

import { ALLOCATION_BUCKETS } from '@/domain/profit-allocation'
import { registry, z } from '@/api/registry'
import { API_BASE_PATH } from '@/api/http'
import { centsSchema, errorResponses, idSchema, monthSchema } from './common'

/**
 * Which of the three destinations a card accepts (files_design/03 "Objeto Item
 * de Destinação"): an Investimento in the two investment cards, a Conta in
 * Reserva em Caixa, free text in Consumo Extraordinário. The domain refuses a
 * mismatch — the screen never renders the wrong field.
 */
export const allocationDestinationSchema = registry.register(
  'AllocationDestination',
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('Investment'), investmentId: idSchema }),
    z.strictObject({ kind: z.literal('BankAccount'), bankAccountId: idSchema }),
    z.strictObject({ kind: z.literal('FreeText'), name: z.string().trim().min(1).max(120) }),
  ]),
)

export const allocationItemSchema = registry.register(
  'AllocationItem',
  z.strictObject({
    /** `null` is an incomplete item, which is allowed and surfaces as a Pendência. */
    destination: allocationDestinationSchema.nullable().default(null),
    amount: centsSchema.min(0),
  }),
)

const itemsByBucket = z.strictObject(
  Object.fromEntries(
    ALLOCATION_BUCKETS.map((bucket) => [bucket, z.array(allocationItemSchema).default([])]),
  ) as Record<
    (typeof ALLOCATION_BUCKETS)[number],
    z.ZodDefault<z.ZodArray<typeof allocationItemSchema>>
  >,
)

export const profitAllocationSchema = registry.register(
  'ProfitAllocation',
  z.object({
    month: monthSchema,
    /** Read-only: the Lucro Líquido the DRE computed for the month. */
    netProfit: centsSchema,
    items: itemsByBucket,
    /** Lucro líquido − soma de todos os itens. Computed, never stored. */
    unallocatedBalance: centsSchema,
  }),
)

export const profitAllocationPutSchema = registry.register(
  'ProfitAllocationPut',
  z.strictObject({ items: itemsByBucket }),
)

const TAG = 'Profit allocation'
/** Exported so the route handler validates the same `{month}` path param this document describes. */
export const monthParams = z.strictObject({ month: monthSchema })
const json = (schema: z.ZodType) => ({ 'application/json': { schema } })

registry.registerPath({
  method: 'get',
  path: `${API_BASE_PATH}/profit-allocations/{month}`,
  tags: [TAG],
  summary: 'Lê a destinação do lucro de um mês',
  request: { params: monthParams },
  responses: {
    200: { description: 'Destinação.', content: json(profitAllocationSchema) },
    ...errorResponses(404, 422),
  },
})

registry.registerPath({
  method: 'put',
  path: `${API_BASE_PATH}/profit-allocations/{month}`,
  tags: [TAG],
  summary: 'Substitui a destinação do lucro de um mês',
  description:
    'PUT e não PATCH: a tela envia os quatro cards inteiros, e um item removido some por ' +
    'ausência. A soma dos itens não pode exceder o lucro líquido (files_design/03).',
  request: {
    params: monthParams,
    body: { content: json(profitAllocationPutSchema), required: true },
  },
  responses: {
    200: { description: 'Destinação gravada.', content: json(profitAllocationSchema) },
    ...errorResponses(400, 404, 409, 422),
  },
})
