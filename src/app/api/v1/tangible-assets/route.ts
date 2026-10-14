/**
 * `GET, POST /api/v1/tangible-assets` — Bens Materiais.
 *
 * No monthly depreciation (PRD §5): `recordedValue` is stored exactly as
 * given, and stays there until the sale recognises a gain or a loss.
 */

import { cents } from '@/domain/core'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { created, list, resourcePath } from '@/api/http'
import { newTangibleAssetSchema } from '@/api/contracts/tangible-assets'

export const GET = handler({
  operation: 'tangible_assets.list',
  handle: async ({ session }) => {
    const { tangibleAssetReader } = getRepositories()
    // The Bens Materiais screen shows only what has not been sold
    // (files_design/01 §3.3, §10) — a sold asset stays queryable by id for
    // past reports, but never in this list.
    const items = await tangibleAssetReader.listUnsold(session.userId)
    return list(items)
  },
})

export const POST = handler({
  operation: 'tangible_assets.create',
  body: newTangibleAssetSchema,
  handle: async ({ session, body }) => {
    const { tangibleAssetWriter } = getRepositories()
    const stored = await tangibleAssetWriter.create(session.userId, {
      name: body.name,
      entity: body.entity,
      recordedValue: cents(body.recordedValue),
    })
    return created(resourcePath('tangible-assets', stored.id), stored)
  },
})
