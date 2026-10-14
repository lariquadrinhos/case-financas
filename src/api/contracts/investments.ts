/**
 * Investimentos — `/api/v1/investments`.
 *
 * `accumulatedValue` is "valor investido acumulado": opening balance plus
 * contributions, with NO mark-to-market. The appreciation is not shown anywhere
 * and gain is realised only on the sale (PRD §1, §5).
 */

import { registry, z } from '@/api/registry'
import {
  centsSchema,
  entitySchema,
  entityWithDefault,
  idSchema,
  registerResource,
  shortTextSchema,
} from './common'

export const investmentSchema = registry.register(
  'Investment',
  z.object({
    id: idSchema,
    name: z.string(),
    entity: entitySchema,
    accumulatedValue: centsSchema,
  }),
)

export const newInvestmentSchema = registry.register(
  'NewInvestment',
  z.strictObject({
    name: shortTextSchema,
    entity: entityWithDefault,
    /**
     * "Valor inicial acumulado" on the onboarding form (files_design/03):
     * opening balance PLUS contributions, a sum of non-negative parts, so it is
     * non-negative too. Same money mask argument as `recordedValue`.
     */
    accumulatedValue: centsSchema.min(0),
  }),
)

export const investmentPatchSchema = registry.register(
  'InvestmentPatch',
  newInvestmentSchema.partial(),
)

export const investmentQuerySchema = z.strictObject({ entity: entitySchema.optional() })

registerResource({
  tag: 'Investments',
  resource: 'investments',
  singular: 'investimento',
  item: investmentSchema,
  create: newInvestmentSchema,
  patch: investmentPatchSchema,
  query: investmentQuerySchema,
  deletable: true,
})
