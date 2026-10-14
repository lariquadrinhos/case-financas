/**
 * Pendente de Direcionamento — `/api/v1/pending-allocations`.
 *
 * A read-only list plus one action. A pending amount is never created by a
 * client: it appears when a sale leaves money undirected (files_design/03), and
 * the only thing a client does is direct it.
 */

import { PENDING_ALLOCATION_STATUSES } from '@/domain/assets'
import { registry, z } from '@/api/registry'
import { API_BASE_PATH } from '@/api/http'
import { allocationSchema } from './tangible-assets'
import {
  centsSchema,
  errorResponses,
  idParams,
  idSchema,
  isoDateSchema,
  listEnvelope,
} from './common'

/** One-variant union on purpose: the sale of a bem material is the only origin any source describes. */
export const allocationOriginSchema = registry.register(
  'AllocationOrigin',
  z.object({ kind: z.literal('TangibleAssetSale'), tangibleAssetId: idSchema }),
)

export const pendingAllocationSchema = registry.register(
  'PendingAllocation',
  z.object({
    id: idSchema,
    origin: allocationOriginSchema,
    amount: centsSchema,
    originDate: isoDateSchema,
    status: z.enum(PENDING_ALLOCATION_STATUSES),
  }),
)

export const directPendingSchema = registry.register(
  'DirectPendingAllocation',
  z.strictObject({ allocations: z.array(allocationSchema).min(1) }),
)

const TAG = 'Pending allocations'
const path = `${API_BASE_PATH}/pending-allocations`
const json = (schema: z.ZodType) => ({ 'application/json': { schema } })

registry.registerPath({
  method: 'get',
  path,
  tags: [TAG],
  summary: 'Lista os valores pendentes de direcionamento',
  description: 'A Home exibe um banner enquanto houver algum com status Pendente.',
  request: { query: z.strictObject({ status: z.enum(PENDING_ALLOCATION_STATUSES).optional() }) },
  responses: {
    200: { description: 'Pendências.', content: json(listEnvelope(pendingAllocationSchema)) },
    ...errorResponses(422),
  },
})

registry.registerPath({
  method: 'post',
  path: `${path}/{id}/allocations`,
  tags: [TAG],
  summary: 'Direciona um valor pendente',
  description: 'Mesma escolha de destino do modal de venda: Investimento, Passivo ou Receita.',
  request: { params: idParams, body: { content: json(directPendingSchema), required: true } },
  responses: {
    200: { description: 'Pendência atualizada.', content: json(pendingAllocationSchema) },
    ...errorResponses(400, 404, 409, 422),
  },
})
