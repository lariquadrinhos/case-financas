/**
 * Bens Materiais — `/api/v1/tangible-assets`.
 *
 * "Bem Material", never "Ativo": in the Balanço, Ativo also covers accounts and
 * investments, and the design renamed the concept to disambiguate
 * (files_design/04).
 *
 * There is no monthly depreciation: `recordedValue` is what the asset is carried
 * at until it is sold, and gain or loss is recognised only in the sale
 * (PRD §5, ADR-0005).
 */

import { ALLOCATION_KINDS } from '@/domain/assets'
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
  registerResource,
  shortTextSchema,
} from './common'

export const tangibleAssetSchema = registry.register(
  'TangibleAsset',
  z.object({
    id: idSchema,
    name: z.string(),
    entity: entitySchema,
    recordedValue: centsSchema,
    /** Set on sale; a sold asset leaves the Bens Materiais list (files_design/01 §11). */
    soldOn: isoDateSchema.nullable(),
  }),
)

export const newTangibleAssetSchema = registry.register(
  'NewTangibleAsset',
  z.strictObject({
    name: shortTextSchema,
    entity: entityWithDefault,
    /**
     * "Valor inicial" on the onboarding form. Non-negative: the money mask
     * (files_design/03 "Convenção geral") starts at R$ 0,00 and takes digits
     * only, so no screen can produce a negative — and a negative Bem Material
     * subtracts from the Ativo in the Balanço and inverts the ganho/perda the
     * sale computes.
     */
    recordedValue: centsSchema.min(0),
  }),
)

export const tangibleAssetPatchSchema = registry.register(
  'TangibleAssetPatch',
  newTangibleAssetSchema.partial(),
)

/**
 * "Objeto Direcionamento" (files_design/03). Exception 2 of the required-by-
 * default rule: the whole list may be empty, and what is left over becomes a
 * Pendente de Direcionamento — never a validation error.
 *
 * `target` is `null` only for `Revenue`, which opens the Receita form instead of
 * pointing at an existing record.
 */
export const allocationSchema = registry.register(
  'Allocation',
  z.strictObject({
    kind: z.enum(ALLOCATION_KINDS),
    target: idSchema.nullable().default(null),
    /** "não pode exceder o Restante disponível no momento" — checked by the domain. */
    amount: centsSchema.min(0),
  }),
)

export const assetSaleSchema = registry.register(
  'AssetSale',
  z.strictObject({
    amount: centsSchema,
    date: isoDateSchema,
    allocations: z.array(allocationSchema).default([]),
    /**
     * Conta em que o Ganho/Perda da venda é reconhecido — decisão de produto
     * de 2026-09-07 (docs/PERGUNTAS-EM-ABERTO.md P33).
     *
     * O modal prometia "Lançado automaticamente em Resultado Não Operacional"
     * (`files_design/01 §11`, e o próprio texto do frame `99:56`) e o
     * Lançamento nunca era criado — o ganho não aparecia em DRE, Balanço,
     * Evolução Mensal nem Indicadores. Criar exigia uma conta, porque todo
     * `Entry` de Receita/Despesa a exige (`src/domain/entries/types.ts`), e
     * nenhum frame desenhava esse campo. Produto decidiu pedir a conta no
     * próprio modal, então o campo é obrigatório aqui.
     */
    gainAccountId: idSchema,
  }),
)

export const assetSaleResultSchema = registry.register(
  'AssetSaleResult',
  z.object({
    asset: tangibleAssetSchema,
    /** Ganho/perda = valor de venda − valor registrado. Computed, never stored. */
    gainOrLoss: centsSchema,
    /** What was not directed becomes a Pendente de Direcionamento on the Home. */
    pendingAmount: centsSchema,
  }),
)

registerResource({
  tag: 'Tangible assets',
  resource: 'tangible-assets',
  singular: 'bem material',
  item: tangibleAssetSchema,
  create: newTangibleAssetSchema,
  patch: tangibleAssetPatchSchema,
  deletable: true,
})

registry.registerPath({
  method: 'post',
  path: `${API_BASE_PATH}/tangible-assets/{id}/sale`,
  tags: ['Tangible assets'],
  summary: 'Vende um bem material',
  description:
    'Gera o lançamento de ganho/perda em Resultado Não Operacional e retira o bem da lista ' +
    '(files_design/01 §11).',
  request: {
    params: idParams,
    body: { content: { 'application/json': { schema: assetSaleSchema } }, required: true },
  },
  responses: {
    200: {
      description: 'Venda registrada.',
      content: { 'application/json': { schema: assetSaleResultSchema } },
    },
    ...errorResponses(400, 404, 409, 422),
  },
})
