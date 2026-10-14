/**
 * Pendência unificada — `/api/v1/pending-items` (Event Storming H13).
 *
 * Read-only over the collection: no client creates a `PendingItem` directly,
 * each of the four kinds is populated by policy elsewhere in the product
 * (files_design/03). The GET here is the ONE query the Home card needs instead
 * of joining four resources itself.
 *
 * The one write this file owns is `POST /payment-discrepancies/{id}/payment`
 * ("Pagar"), because a payment discrepancy (tipo 4) is the one kind with
 * nowhere else to resolve — the other three already resolve through their own
 * resource (`pending-allocations`, `occurrences`, `profit-allocations`).
 */

import { PAYMENT_DISCREPANCY_STATUSES } from '@/domain/pending-items'
import { registry, z } from '@/api/registry'
import { API_BASE_PATH } from '@/api/http'
import { occurrenceSchema } from './recurrences'
import { pendingAllocationSchema } from './pending-allocations'
import {
  centsSchema,
  entitySchema,
  errorResponses,
  idParams,
  idSchema,
  isoDateSchema,
  listEnvelope,
  monthSchema,
} from './common'

/* -------------------------------------------------------------------------
 * Tipo 4 — Divergência de pagamento a menor
 * ---------------------------------------------------------------------- */

/** One-variant union on purpose — same reasoning as `AllocationOrigin` (pending-allocations). */
export const paymentDiscrepancyOriginSchema = registry.register(
  'PaymentDiscrepancyOrigin',
  z.object({ kind: z.literal('Entry'), entryId: idSchema }),
)

export const paymentDiscrepancySchema = registry.register(
  'PaymentDiscrepancy',
  z.object({
    id: idSchema,
    origin: paymentDiscrepancyOriginSchema,
    /** "a diferença" (files_design/03) — the shortfall only, never the full paid amount. */
    shortfall: centsSchema,
    originDate: isoDateSchema,
    status: z.enum(PAYMENT_DISCREPANCY_STATUSES),
  }),
)

/* -------------------------------------------------------------------------
 * Tipo 3 — a forma que o Home vê o saldo não alocado
 * ---------------------------------------------------------------------- */

export const unallocatedProfitPendingItemSchema = registry.register(
  'UnallocatedProfitPendingItem',
  z.object({ kind: z.literal('UnallocatedProfit'), month: monthSchema, amount: centsSchema }),
)

/* -------------------------------------------------------------------------
 * O read model unificado
 * ---------------------------------------------------------------------- */

/**
 * `amount` is `null` only for `UndefinedOccurrence`: an "a definir" occurrence
 * has, by definition, no value yet (`@/domain/pending-items`).
 */
/** P14 — a sobra de um mês fechado que ainda está sem destino. */
export const discretionaryLeftoverPendingItemSchema = registry.register(
  'DiscretionaryLeftoverPendingItem',
  z.object({ month: monthSchema, remaining: centsSchema }),
)

export const pendingItemSchema = registry.register(
  'PendingItem',
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('UnclassifiedTransfer'),
      date: isoDateSchema,
      amount: centsSchema,
      item: z.object({
        transactionId: z.string(),
        from: entitySchema,
        to: entitySchema,
        fromBankAccountId: idSchema,
        toBankAccountId: idSchema,
        description: z.string(),
      }),
    }),
    z.object({
      kind: z.literal('Uncategorized'),
      date: isoDateSchema,
      amount: z.null(),
      item: z.object({ month: monthSchema, count: z.number().int() }),
    }),
    z.object({
      kind: z.literal('DiscretionaryLeftover'),
      date: isoDateSchema,
      amount: centsSchema,
      item: discretionaryLeftoverPendingItemSchema,
    }),
    z.object({
      kind: z.literal('AssetSaleAllocation'),
      date: isoDateSchema,
      amount: centsSchema,
      item: pendingAllocationSchema,
    }),
    z.object({
      kind: z.literal('UndefinedOccurrence'),
      date: isoDateSchema,
      amount: z.null(),
      item: occurrenceSchema,
    }),
    z.object({
      kind: z.literal('UnallocatedProfit'),
      date: isoDateSchema,
      amount: centsSchema,
      item: unallocatedProfitPendingItemSchema,
    }),
    z.object({
      kind: z.literal('PaymentDiscrepancy'),
      date: isoDateSchema,
      amount: centsSchema,
      item: paymentDiscrepancySchema,
    }),
  ]),
)

const json = (schema: z.ZodType) => ({ 'application/json': { schema } })

registry.registerPath({
  method: 'get',
  path: `${API_BASE_PATH}/pending-items`,
  tags: ['Pending items'],
  summary: 'Lista a Pendência unificada, mais antiga primeiro, através dos 4 tipos',
  description:
    'Combina Pendente de Direcionamento, ocorrência "a definir" sem valor, saldo não alocado ' +
    'da Destinação do Lucro e divergência de pagamento a menor (PRD §5, Event Storming H13).',
  responses: {
    200: { description: 'Pendências.', content: json(listEnvelope(pendingItemSchema)) },
    ...errorResponses(422),
  },
})

registry.registerPath({
  method: 'post',
  path: `${API_BASE_PATH}/payment-discrepancies/{id}/payment`,
  tags: ['Pending items'],
  summary: 'Registra o pagamento da diferença — "Pagar"',
  description: 'A única ação que uma Divergência de pagamento a menor oferece (PRD §5).',
  request: { params: idParams },
  responses: {
    200: { description: 'Divergência paga.', content: json(paymentDiscrepancySchema) },
    ...errorResponses(404, 409),
  },
})

/**
 * O corpo de `POST /leftover-directions` — P14.
 *
 * `Discretionary` não carrega chave: é a sobra voltando para a verba do mês,
 * e não aponta para agregado nenhum.
 */
export const leftoverDirectionSchema = registry.register(
  'LeftoverDirection',
  z.strictObject({
    month: monthSchema,
    amount: centsSchema.min(1),
    destination: z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('Discretionary') }),
      z.strictObject({ kind: z.literal('BankAccount'), bankAccountId: idSchema }),
      z.strictObject({ kind: z.literal('Investment'), investmentId: idSchema }),
      z.strictObject({ kind: z.literal('Liability'), liabilityId: idSchema }),
    ]),
  }),
)
