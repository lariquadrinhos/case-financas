/**
 * `PATCH /api/v1/categories/{id}` — "Editar" on a category line (Figma 46:33).
 *
 * No `DELETE`: there is no delete for a category (files_design/01 §3.1) — see
 * `./archive/route.ts` for the one action that retires one.
 */

import {
  markPassiveIncome,
  renameCategory,
  updateSuggestedClassification,
  type ChartOfAccounts,
} from '@/domain/chart-of-accounts'
import { asId, type CategoryId } from '@/domain/core'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { NotFoundError, ok } from '@/api/http'
import { categoryPatchSchema } from '@/api/contracts/chart-of-accounts'
import { idParams } from '@/api/contracts/common'

export const PATCH = handler({
  operation: 'chart_of_accounts.update_category',
  params: idParams,
  body: categoryPatchSchema,
  handle: async ({ session, params, body }) => {
    const { categoryReader, categoryWriter } = getRepositories()
    const categoryId = asId<CategoryId>(params.id)

    const existing = await categoryReader.findById(session.userId, categoryId)
    if (existing === null) {
      throw new NotFoundError('A categoria solicitada não existe.')
    }

    // Blocks are irrelevant to both rules below (neither reads `chart.blocks`),
    // so the chart is assembled with only what they need — one query, not two.
    let chart: ChartOfAccounts = {
      blocks: [],
      categories: await categoryReader.list(session.userId),
    }
    if (body.name !== undefined) {
      chart = renameCategory(chart, categoryId, body.name)
    }
    if (body.suggestedClassification !== undefined) {
      chart = updateSuggestedClassification(chart, categoryId, body.suggestedClassification)
    }
    if (body.isPassiveIncome !== undefined) {
      chart = markPassiveIncome(chart, categoryId, body.isPassiveIncome)
    }

    const updated = chart.categories.find((category) => category.id === categoryId)!
    const stored = await categoryWriter.replace(session.userId, updated)
    return ok(stored)
  },
})
