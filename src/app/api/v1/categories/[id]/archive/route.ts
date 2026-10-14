/**
 * `POST /api/v1/categories/{id}/archive` — "Descartar" on a category line
 * (Figma 44:43). Not a delete: an archived category stays in the chart because
 * past Lançamentos still point at its id (files_design/01 §3.1).
 */

import { archiveCategory } from '@/domain/chart-of-accounts'
import { asId, type CategoryId } from '@/domain/core'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { ok } from '@/api/http'
import { idParams } from '@/api/contracts/common'

export const POST = handler({
  operation: 'chart_of_accounts.archive_category',
  params: idParams,
  handle: async ({ session, params }) => {
    const { categoryReader, categoryWriter } = getRepositories()
    const categoryId = asId<CategoryId>(params.id)

    // `archiveCategory` reads only `chart.categories` — blocks are irrelevant here.
    const categories = await categoryReader.list(session.userId)
    const chart = archiveCategory({ blocks: [], categories }, categoryId)

    const updated = chart.categories.find((category) => category.id === categoryId)!
    const stored = await categoryWriter.replace(session.userId, updated)
    return ok(stored)
  },
})
