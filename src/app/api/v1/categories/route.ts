/**
 * `GET, POST /api/v1/categories` — the editable half of the Plano de Contas.
 *
 * Business rules stay in `src/domain/chart-of-accounts` (SRP — this file
 * parses, authorises, delegates and serialises, nothing else): `createCategory`
 * is the one place that knows a block can refuse categories, that a name
 * cannot repeat inside a block, and that a blank name is not a name
 * (files_design/01 §3.1, §5.6). This route only assembles the `ChartOfAccounts`
 * the rule needs and persists what it approved.
 */

import { randomUUID } from 'node:crypto'

import { createCategory } from '@/domain/chart-of-accounts'
import { asId, type BlockId, type CategoryId } from '@/domain/core'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { created, list, resourcePath } from '@/api/http'
import { categoryQuerySchema, newCategorySchema } from '@/api/contracts/chart-of-accounts'

export const GET = handler({
  operation: 'chart_of_accounts.list_categories',
  query: categoryQuerySchema,
  handle: async ({ session, query }) => {
    const { categoryReader } = getRepositories()
    const includeArchived = query.includeArchived === 'true'

    if (query.blockId !== undefined) {
      const inBlock = await categoryReader.listByBlock(session.userId, asId<BlockId>(query.blockId))
      const filtered = includeArchived ? inBlock : inBlock.filter((category) => !category.archived)
      return list(filtered)
    }

    const categories = includeArchived
      ? await categoryReader.list(session.userId)
      : await categoryReader.listActive(session.userId)
    return list(categories)
  },
})

export const POST = handler({
  operation: 'chart_of_accounts.create_category',
  body: newCategorySchema,
  handle: async ({ session, body }) => {
    const { categoryReader, categoryWriter, statementBlockReader } = getRepositories()
    const [blocks, categories] = await Promise.all([
      statementBlockReader.list(session.userId),
      categoryReader.list(session.userId),
    ])

    // Validation only: the id is thrown away and the writer assigns the real
    // one (src/data/contracts/common.ts — "ids are assigned by the writer").
    // `createCategory` always appends the new record last, so it is the
    // chart's final element after a successful call.
    const validated = createCategory(
      { blocks, categories },
      {
        id: asId<CategoryId>(randomUUID()),
        blockId: asId<BlockId>(body.blockId),
        name: body.name,
        suggestedClassification: body.suggestedClassification,
      },
    )
    const draft = validated.categories[validated.categories.length - 1]!

    const stored = await categoryWriter.create(session.userId, {
      blockId: draft.blockId,
      name: draft.name,
      isSystem: draft.isSystem,
      suggestedClassification: draft.suggestedClassification,
      archived: draft.archived,
      isPassiveIncome: draft.isPassiveIncome,
    })
    return created(resourcePath('categories', stored.id), stored)
  },
})
