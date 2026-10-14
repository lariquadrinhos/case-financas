/**
 * Pendente de Direcionamento — the SQLite adapter for
 * `src/data/contracts/pending-allocations.ts`.
 *
 * One-variant origin union today (`TangibleAssetSale`), mirrored 1:1 from
 * `src/domain/assets/types.ts` — the table carries the same shape rather than a
 * generic `origin_id` column, so a row that is not a valid origin cannot exist.
 */

import { randomUUID } from 'node:crypto'

import { and, eq, sql } from 'drizzle-orm'

import { cents } from '@/domain/core'
import type { PendingAllocation } from '@/domain/assets'
import { asId, type IsoDate, type PendingAllocationId, type TangibleAssetId } from '@/domain/core'
import type {
  NewPendingAllocation,
  PendingAllocationReader,
  PendingAllocationWriter,
} from '@/data/contracts/pending-allocations'
import type { PendingAllocationStatus } from '@/domain/assets'
import type { Page, UserId } from '@/data/contracts/common'
import type { BigornaDatabase } from './client'
import { pendingAllocations } from './schema'

type PendingAllocationRow = typeof pendingAllocations.$inferSelect

function toPendingAllocation(row: PendingAllocationRow): PendingAllocation {
  return {
    id: asId<PendingAllocationId>(row.id),
    origin: {
      kind: 'TangibleAssetSale',
      tangibleAssetId: asId<TangibleAssetId>(row.originTangibleAssetId),
    },
    amount: cents(row.amount),
    originDate: row.originDate as IsoDate,
    status: row.status,
  }
}

export function createPendingAllocationRepository(db: BigornaDatabase): {
  reader: PendingAllocationReader
  writer: PendingAllocationWriter
} {
  const reader: PendingAllocationReader = {
    async findById(userId: UserId, id: PendingAllocationId) {
      const row = db
        .select()
        .from(pendingAllocations)
        .where(and(eq(pendingAllocations.userId, userId), eq(pendingAllocations.id, id)))
        .get()
      return row ? toPendingAllocation(row) : null
    },

    async list(userId: UserId, page?: Page) {
      const query = db
        .select()
        .from(pendingAllocations)
        .where(eq(pendingAllocations.userId, userId))
      const rows =
        page === undefined ? query.all() : query.limit(page.limit).offset(page.offset).all()
      return rows.map(toPendingAllocation)
    },

    async count(userId: UserId) {
      const row = db
        .select({ total: sql<number>`count(*)` })
        .from(pendingAllocations)
        .where(eq(pendingAllocations.userId, userId))
        .get()
      return row?.total ?? 0
    },

    // "Ordenados da mais antiga para a mais nova" (PRD §1) — the Home reads
    // Pending items oldest-first so the person resolves the longest-standing one.
    async listByStatus(userId: UserId, status: PendingAllocationStatus) {
      const rows = db
        .select()
        .from(pendingAllocations)
        .where(and(eq(pendingAllocations.userId, userId), eq(pendingAllocations.status, status)))
        .orderBy(pendingAllocations.originDate)
        .all()
      return rows.map(toPendingAllocation)
    },
  }

  const writer: PendingAllocationWriter = {
    async create(userId: UserId, value: NewPendingAllocation) {
      const id = randomUUID()
      db.insert(pendingAllocations)
        .values({
          userId,
          id,
          originKind: value.origin.kind,
          originTangibleAssetId: value.origin.tangibleAssetId,
          amount: value.amount,
          originDate: value.originDate,
          status: value.status,
        })
        .run()
      return { id: asId<PendingAllocationId>(id), ...value }
    },

    async replace(userId: UserId, value: PendingAllocation) {
      const result = db
        .update(pendingAllocations)
        .set({
          originKind: value.origin.kind,
          originTangibleAssetId: value.origin.tangibleAssetId,
          amount: value.amount,
          originDate: value.originDate,
          status: value.status,
        })
        .where(and(eq(pendingAllocations.userId, userId), eq(pendingAllocations.id, value.id)))
        .run()
      if (result.changes === 0) {
        throw new Error('pending_allocations.not_found')
      }
      return value
    },

    async remove(userId: UserId, id: PendingAllocationId) {
      db.delete(pendingAllocations)
        .where(and(eq(pendingAllocations.userId, userId), eq(pendingAllocations.id, id)))
        .run()
    },
  }

  return { reader, writer }
}
