/**
 * Divergência de pagamento a menor — the SQLite adapter for
 * `src/data/contracts/pending-items.ts`.
 *
 * One-variant origin today (`Entry`), same shape-mirroring reasoning as
 * `pending-allocations.repository.ts`: the table carries the origin's own
 * columns rather than a generic `origin_id`, so a row that is not a valid
 * origin cannot exist.
 */

import { randomUUID } from 'node:crypto'

import { and, eq, sql } from 'drizzle-orm'

import { cents } from '@/domain/core'
import type {
  PaymentDiscrepancyPendingItem,
  PaymentDiscrepancyStatus,
} from '@/domain/pending-items'
import { asId, type EntryId, type IsoDate, type PaymentDiscrepancyId } from '@/domain/core'
import type {
  NewPaymentDiscrepancy,
  PaymentDiscrepancyReader,
  PaymentDiscrepancyWriter,
} from '@/data/contracts/pending-items'
import type { Page, UserId } from '@/data/contracts/common'
import type { BigornaDatabase } from './client'
import { paymentDiscrepancies } from './schema'

type PaymentDiscrepancyRow = typeof paymentDiscrepancies.$inferSelect

function toPaymentDiscrepancy(row: PaymentDiscrepancyRow): PaymentDiscrepancyPendingItem {
  return {
    id: asId<PaymentDiscrepancyId>(row.id),
    origin: { kind: 'Entry', entryId: asId<EntryId>(row.originEntryId) },
    shortfall: cents(row.shortfall),
    originDate: row.originDate as IsoDate,
    status: row.status,
  }
}

export function createPaymentDiscrepancyRepository(db: BigornaDatabase): {
  reader: PaymentDiscrepancyReader
  writer: PaymentDiscrepancyWriter
} {
  const reader: PaymentDiscrepancyReader = {
    async findById(userId: UserId, id: PaymentDiscrepancyId) {
      const row = db
        .select()
        .from(paymentDiscrepancies)
        .where(and(eq(paymentDiscrepancies.userId, userId), eq(paymentDiscrepancies.id, id)))
        .get()
      return row ? toPaymentDiscrepancy(row) : null
    },

    async list(userId: UserId, page?: Page) {
      const query = db
        .select()
        .from(paymentDiscrepancies)
        .where(eq(paymentDiscrepancies.userId, userId))
      const rows =
        page === undefined ? query.all() : query.limit(page.limit).offset(page.offset).all()
      return rows.map(toPaymentDiscrepancy)
    },

    async count(userId: UserId) {
      const row = db
        .select({ total: sql<number>`count(*)` })
        .from(paymentDiscrepancies)
        .where(eq(paymentDiscrepancies.userId, userId))
        .get()
      return row?.total ?? 0
    },

    // "Ordenados da mais antiga para a mais nova" (PRD §1) — same ordering as pending-allocations.
    async listByStatus(userId: UserId, status: PaymentDiscrepancyStatus) {
      const rows = db
        .select()
        .from(paymentDiscrepancies)
        .where(
          and(eq(paymentDiscrepancies.userId, userId), eq(paymentDiscrepancies.status, status)),
        )
        .orderBy(paymentDiscrepancies.originDate)
        .all()
      return rows.map(toPaymentDiscrepancy)
    },
  }

  const writer: PaymentDiscrepancyWriter = {
    async create(userId: UserId, value: NewPaymentDiscrepancy) {
      const id = randomUUID()
      db.insert(paymentDiscrepancies)
        .values({
          userId,
          id,
          originKind: value.origin.kind,
          originEntryId: value.origin.entryId,
          shortfall: value.shortfall,
          originDate: value.originDate,
          status: value.status,
        })
        .run()
      return { id: asId<PaymentDiscrepancyId>(id), ...value }
    },

    async replace(userId: UserId, value: PaymentDiscrepancyPendingItem) {
      const result = db
        .update(paymentDiscrepancies)
        .set({
          originKind: value.origin.kind,
          originEntryId: value.origin.entryId,
          shortfall: value.shortfall,
          originDate: value.originDate,
          status: value.status,
        })
        .where(and(eq(paymentDiscrepancies.userId, userId), eq(paymentDiscrepancies.id, value.id)))
        .run()
      if (result.changes === 0) {
        throw new Error('payment_discrepancies.not_found')
      }
      return value
    },

    async remove(userId: UserId, id: PaymentDiscrepancyId) {
      db.delete(paymentDiscrepancies)
        .where(and(eq(paymentDiscrepancies.userId, userId), eq(paymentDiscrepancies.id, id)))
        .run()
    },
  }

  return { reader, writer }
}
