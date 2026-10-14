/**
 * Plano de Contas — `/api/v1/statement-blocks` and `/api/v1/categories`.
 *
 * Two resources, not one: the 10 blocks are fixed for the person and only the
 * categories inside them are editable (files_design/01 §3.1). The blocks are
 * therefore read-only over HTTP, and there is no `DELETE /categories/{id}` —
 * an unused category is ARCHIVED, never removed, because entries already point
 * at it (Event Storming Fluxo A).
 */

import { CASCADE_EFFECTS } from '@/domain/chart-of-accounts'
import { registry, z } from '@/api/registry'
import { API_BASE_PATH } from '@/api/http'
import {
  classificationSchema,
  errorResponses,
  idParams,
  idSchema,
  listEnvelope,
  shortTextSchema,
} from './common'

export const statementBlockSchema = registry.register(
  'StatementBlock',
  z.object({
    id: idSchema,
    name: z.string(),
    order: z.number().int().min(1),
    effect: z.enum(CASCADE_EFFECTS),
    /** Block 10 sits below the Lucro Líquido line and never reduces the operating result. */
    belowTheLine: z.boolean(),
    /** False only on D&A, which is read-only and always zero in the MVP (PRD §5). */
    acceptsUserCategories: z.boolean(),
    statementLabel: z.string().nullable(),
  }),
)

export const categorySchema = registry.register(
  'Category',
  z.object({
    id: idSchema,
    blockId: idSchema,
    name: z.string(),
    /** "Consumo Livre" is a system category: it cannot be renamed nor archived. */
    isSystem: z.boolean(),
    suggestedClassification: classificationSchema.nullable(),
    archived: z.boolean(),
    /**
     * Conta em "Cobertura por renda passiva" (files_design/08 §10). Marcado
     * pela pessoa no Plano de Contas; nasce `true` nas duas categorias de
     * renda passiva do plano de referência (P22, decisão de 2026-09-08).
     */
    isPassiveIncome: z.boolean(),
  }),
)

export const newCategorySchema = registry.register(
  'NewCategory',
  z.strictObject({
    blockId: idSchema,
    name: shortTextSchema,
    /**
     * Exception 3 of files_design/03 with no documented default: a category
     * created inline from the Novo Lançamento form carries no suggestion
     * (PERGUNTAS-EM-ABERTO P8), so `null` is the value, not an omission.
     */
    suggestedClassification: classificationSchema.nullable().default(null),
  }),
)

export const categoryPatchSchema = registry.register(
  'CategoryPatch',
  z.strictObject({
    name: shortTextSchema.optional(),
    suggestedClassification: classificationSchema.nullable().optional(),
    isPassiveIncome: z.boolean().optional(),
  }),
)

export const categoryQuerySchema = z.strictObject({
  blockId: idSchema.optional(),
  /** Archived categories are hidden by default: the screen lists what is usable. */
  includeArchived: z.enum(['true', 'false']).default('false'),
})

const BLOCKS_TAG = 'Chart of accounts'
const blocksPath = `${API_BASE_PATH}/statement-blocks`
const categoriesPath = `${API_BASE_PATH}/categories`

registry.registerPath({
  method: 'get',
  path: blocksPath,
  tags: [BLOCKS_TAG],
  summary: 'Lista os 10 blocos do DRE',
  responses: {
    200: {
      description: 'Blocos, na ordem da cascata.',
      content: { 'application/json': { schema: listEnvelope(statementBlockSchema) } },
    },
    ...errorResponses(),
  },
})

registry.registerPath({
  method: 'get',
  path: categoriesPath,
  tags: [BLOCKS_TAG],
  summary: 'Lista categorias',
  request: { query: categoryQuerySchema },
  responses: {
    200: {
      description: 'Categorias.',
      content: { 'application/json': { schema: listEnvelope(categorySchema) } },
    },
    ...errorResponses(422),
  },
})

registry.registerPath({
  method: 'post',
  path: categoriesPath,
  tags: [BLOCKS_TAG],
  summary: 'Cria uma categoria dentro de um bloco',
  request: {
    body: { content: { 'application/json': { schema: newCategorySchema } }, required: true },
  },
  responses: {
    201: {
      description: 'Criada.',
      headers: z.object({ location: z.string() }),
      content: { 'application/json': { schema: categorySchema } },
    },
    ...errorResponses(400, 404, 409, 422),
  },
})

registry.registerPath({
  method: 'patch',
  path: `${categoriesPath}/{id}`,
  tags: [BLOCKS_TAG],
  summary: 'Renomeia uma categoria',
  request: {
    params: idParams,
    body: { content: { 'application/json': { schema: categoryPatchSchema } }, required: true },
  },
  responses: {
    200: { description: 'Categoria.', content: { 'application/json': { schema: categorySchema } } },
    ...errorResponses(400, 404, 409, 422),
  },
})

registry.registerPath({
  method: 'post',
  path: `${categoriesPath}/{id}/archive`,
  tags: [BLOCKS_TAG],
  summary: 'Arquiva uma categoria',
  description:
    'Não existe excluir categoria: os lançamentos antigos continuam apontando para ela ' +
    '(files_design/01 §3.1).',
  request: { params: idParams },
  responses: {
    200: {
      description: 'Categoria arquivada.',
      content: { 'application/json': { schema: categorySchema } },
    },
    ...errorResponses(404, 409),
  },
})
