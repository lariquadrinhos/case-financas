/**
 * Investimentos — the SQLite adapter for `src/data/contracts/investments.ts`.
 *
 * `accumulatedValue` is opening balance plus contributions, with no
 * mark-to-market (PRD §1) — stored exactly as given, never derived here.
 */

import { randomUUID } from 'node:crypto'

import { and, eq, sql } from 'drizzle-orm'

import { isForeignKeyViolation } from './constraint-errors'
import { cents } from '@/domain/core'
import type { Investment } from '@/domain/assets'
import { asId, type Entity, type InvestmentId } from '@/domain/core'
import type {
  InvestmentReader,
  InvestmentWriter,
  NewInvestment,
} from '@/data/contracts/investments'
import type { Page, UserId } from '@/data/contracts/common'
import type { BigornaDatabase } from './client'
import { investments } from './schema'

type InvestmentRow = typeof investments.$inferSelect

function toInvestment(row: InvestmentRow): Investment {
  return {
    id: asId<InvestmentId>(row.id),
    name: row.name,
    entity: row.entity,
    accumulatedValue: cents(row.accumulatedValue),
  }
}

export function createInvestmentRepository(db: BigornaDatabase): {
  reader: InvestmentReader
  writer: InvestmentWriter
} {
  const reader: InvestmentReader = {
    async findById(userId: UserId, id: InvestmentId) {
      const row = db
        .select()
        .from(investments)
        .where(and(eq(investments.userId, userId), eq(investments.id, id)))
        .get()
      return row ? toInvestment(row) : null
    },

    async list(userId: UserId, page?: Page) {
      const query = db.select().from(investments).where(eq(investments.userId, userId))
      const rows =
        page === undefined ? query.all() : query.limit(page.limit).offset(page.offset).all()
      return rows.map(toInvestment)
    },

    async count(userId: UserId) {
      const row = db
        .select({ total: sql<number>`count(*)` })
        .from(investments)
        .where(eq(investments.userId, userId))
        .get()
      return row?.total ?? 0
    },

    async listByEntity(userId: UserId, entity: Entity) {
      const rows = db
        .select()
        .from(investments)
        .where(and(eq(investments.userId, userId), eq(investments.entity, entity)))
        .all()
      return rows.map(toInvestment)
    },
  }

  const writer: InvestmentWriter = {
    async create(userId: UserId, value: NewInvestment) {
      const id = randomUUID()
      db.insert(investments)
        .values({ userId, id, ...value })
        .run()
      return { id: asId<InvestmentId>(id), ...value }
    },

    async replace(userId: UserId, value: Investment) {
      const result = db
        .update(investments)
        .set({
          name: value.name,
          entity: value.entity,
          accumulatedValue: value.accumulatedValue,
        })
        .where(and(eq(investments.userId, userId), eq(investments.id, value.id)))
        .run()
      if (result.changes === 0) {
        throw new Error('investments.not_found')
      }
      return value
    },

    async remove(userId: UserId, id: InvestmentId) {
      try {
        db.delete(investments)
          .where(and(eq(investments.userId, userId), eq(investments.id, id)))
          .run()
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          throw new Error('investments.in_use')
        }
        throw error
      }
    },
  }

  return { reader, writer }
}
