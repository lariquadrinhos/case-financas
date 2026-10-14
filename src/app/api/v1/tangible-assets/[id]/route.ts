/**
 * `GET, PATCH, DELETE /api/v1/tangible-assets/{id}`.
 *
 * `PATCH` is for correcting the cadastro (name, entity, valor inicial) — it
 * never sets `soldOn`, which only `POST .../sale` (`./sale/route.ts`) does,
 * because a sale also computes a gain/loss and may create a Pendente de
 * Direcionamento (files_design/01 §11).
 */

import type { TangibleAsset } from '@/domain/assets'
import { asId, cents, type TangibleAssetId } from '@/domain/core'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { NotFoundError, noContent, ok } from '@/api/http'
import { tangibleAssetPatchSchema } from '@/api/contracts/tangible-assets'
import { idParams } from '@/api/contracts/common'

export const GET = handler({
  operation: 'tangible_assets.read',
  params: idParams,
  handle: async ({ session, params }) => {
    const { tangibleAssetReader } = getRepositories()
    const asset = await tangibleAssetReader.findById(
      session.userId,
      asId<TangibleAssetId>(params.id),
    )
    if (asset === null) {
      throw new NotFoundError('O bem material solicitado não existe.')
    }
    return ok(asset)
  },
})

export const PATCH = handler({
  operation: 'tangible_assets.update',
  params: idParams,
  body: tangibleAssetPatchSchema,
  handle: async ({ session, params, body }) => {
    const { tangibleAssetReader, tangibleAssetWriter } = getRepositories()
    const assetId = asId<TangibleAssetId>(params.id)
    const existing = await tangibleAssetReader.findById(session.userId, assetId)
    if (existing === null) {
      throw new NotFoundError('O bem material solicitado não existe.')
    }

    const updated: TangibleAsset = {
      ...existing,
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.entity !== undefined ? { entity: body.entity } : {}),
      ...(body.recordedValue !== undefined ? { recordedValue: cents(body.recordedValue) } : {}),
    }
    const stored = await tangibleAssetWriter.replace(session.userId, updated)
    return ok(stored)
  },
})

export const DELETE = handler({
  operation: 'tangible_assets.remove',
  params: idParams,
  handle: async ({ session, params }) => {
    const { tangibleAssetReader, tangibleAssetWriter } = getRepositories()
    const assetId = asId<TangibleAssetId>(params.id)
    const existing = await tangibleAssetReader.findById(session.userId, assetId)
    if (existing === null) {
      throw new NotFoundError('O bem material solicitado não existe.')
    }
    await tangibleAssetWriter.remove(session.userId, assetId)
    return noContent()
  },
})
