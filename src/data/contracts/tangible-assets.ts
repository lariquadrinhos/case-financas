/**
 * Bens Materiais. A sold asset leaves the list but stays in the table: the
 * Balanço of a past month still needs it, and the gain was recognised in the
 * month of the sale (files_design/01 §11, PRD §5).
 */

import type { TangibleAsset } from '@/domain/assets'
import type { TangibleAssetId } from '@/domain/core'
import type { Reader, UserId, Writer } from './common'

export type NewTangibleAsset = Omit<TangibleAsset, 'id' | 'soldOn'>

export interface TangibleAssetReader extends Reader<TangibleAsset, TangibleAssetId> {
  /** What the Bens Materiais screen shows: the ones not sold yet. */
  listUnsold(userId: UserId): Promise<readonly TangibleAsset[]>
}

export type TangibleAssetWriter = Writer<TangibleAsset, NewTangibleAsset, TangibleAssetId>
