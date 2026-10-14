/**
 * Bens Materiais — the SQLite adapter for `src/data/contracts/tangible-assets.ts`.
 *
 * A sold asset stays in the table (`soldOn` set) rather than being deleted: a
 * Balanço of a past month still needs it, and the gain was recognised in the
 * month of the sale (files_design/01 §11, PRD §5) — `listUnsold` is what the
 * Bens Materiais screen actually reads.
 */

import { randomUUID } from 'node:crypto'

import { and, eq, isNull, sql } from 'drizzle-orm'

import { isForeignKeyViolation } from './constraint-errors'
import { cents } from '@/domain/core'
import type { TangibleAsset } from '@/domain/assets'
import { asId, type IsoDate, type TangibleAssetId } from '@/domain/core'
import type {
  NewTangibleAsset,
  TangibleAssetReader,
  TangibleAssetWriter,
} from '@/data/contracts/tangible-assets'
import type { Page, UserId } from '@/data/contracts/common'
import type { BigornaDatabase } from './client'
import { tangibleAssets } from './schema'

type TangibleAssetRow = typeof tangibleAssets.$inferSelect

function toTangibleAsset(row: TangibleAssetRow): TangibleAsset {
  return {
    id: asId<TangibleAssetId>(row.id),
    name: row.name,
    entity: row.entity,
    recordedValue: cents(row.recordedValue),
    soldOn: row.soldOn === null ? null : (row.soldOn as IsoDate),
  }
}

export function createTangibleAssetRepository(db: BigornaDatabase): {
  reader: TangibleAssetReader
  writer: TangibleAssetWriter
} {
  const reader: TangibleAssetReader = {
    async findById(userId: UserId, id: TangibleAssetId) {
      const row = db
        .select()
        .from(tangibleAssets)
        .where(and(eq(tangibleAssets.userId, userId), eq(tangibleAssets.id, id)))
        .get()
      return row ? toTangibleAsset(row) : null
    },

    async list(userId: UserId, page?: Page) {
      const query = db.select().from(tangibleAssets).where(eq(tangibleAssets.userId, userId))
      const rows =
        page === undefined ? query.all() : query.limit(page.limit).offset(page.offset).all()
      return rows.map(toTangibleAsset)
    },

    async count(userId: UserId) {
      const row = db
        .select({ total: sql<number>`count(*)` })
        .from(tangibleAssets)
        .where(eq(tangibleAssets.userId, userId))
        .get()
      return row?.total ?? 0
    },

    async listUnsold(userId: UserId) {
      const rows = db
        .select()
        .from(tangibleAssets)
        .where(and(eq(tangibleAssets.userId, userId), isNull(tangibleAssets.soldOn)))
        .all()
      return rows.map(toTangibleAsset)
    },
  }

  const writer: TangibleAssetWriter = {
    async create(userId: UserId, value: NewTangibleAsset) {
      const id = randomUUID()
      db.insert(tangibleAssets)
        .values({ userId, id, ...value, soldOn: null })
        .run()
      return { id: asId<TangibleAssetId>(id), ...value, soldOn: null }
    },

    async replace(userId: UserId, value: TangibleAsset) {
      const result = db
        .update(tangibleAssets)
        .set({
          name: value.name,
          entity: value.entity,
          recordedValue: value.recordedValue,
          soldOn: value.soldOn,
        })
        .where(and(eq(tangibleAssets.userId, userId), eq(tangibleAssets.id, value.id)))
        .run()
      if (result.changes === 0) {
        throw new Error('tangible_assets.not_found')
      }
      return value
    },

    async remove(userId: UserId, id: TangibleAssetId) {
      try {
        db.delete(tangibleAssets)
          .where(and(eq(tangibleAssets.userId, userId), eq(tangibleAssets.id, id)))
          .run()
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          throw new Error('tangible_assets.in_use')
        }
        throw error
      }
    },
  }

  return { reader, writer }
}
