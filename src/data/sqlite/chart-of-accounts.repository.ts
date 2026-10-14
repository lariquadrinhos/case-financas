/**
 * Plano de Contas — the SQLite adapter for the ports in
 * `src/data/contracts/chart-of-accounts.ts`.
 *
 * Two tables, mapped 1:1 to the domain shapes (`StatementBlock`, `Category`),
 * because the port speaks domain types and this file is the only place that
 * knows a Drizzle row exists (docs/ARCHITECTURE.md §4).
 *
 * `order` is read back as `sort_order` — `order` is a reserved SQL word, so the
 * column is renamed in `schema.ts` and this file is where the rename is
 * undone.
 */

import { randomUUID } from 'node:crypto'

import { and, asc, eq, sql } from 'drizzle-orm'

import type { Category, StatementBlock } from '@/domain/chart-of-accounts'
import { asId, type BlockId, type CategoryId } from '@/domain/core'
import type {
  CategoryReader,
  CategoryWriter,
  NewCategory,
  StatementBlockReader,
  StatementBlockWriter,
} from '@/data/contracts/chart-of-accounts'
import type { Page, UserId } from '@/data/contracts/common'
import type { BigornaDatabase } from './client'
import { categories, statementBlocks } from './schema'

type StatementBlockRow = typeof statementBlocks.$inferSelect
type CategoryRow = typeof categories.$inferSelect

function toStatementBlock(row: StatementBlockRow): StatementBlock {
  return {
    id: asId<BlockId>(row.id),
    name: row.name,
    order: row.order,
    effect: row.effect,
    belowTheLine: row.belowTheLine,
    acceptsUserCategories: row.acceptsUserCategories,
    statementLabel: row.statementLabel,
  }
}

function toCategory(row: CategoryRow): Category {
  return {
    id: asId<CategoryId>(row.id),
    blockId: asId<BlockId>(row.blockId),
    name: row.name,
    isSystem: row.isSystem,
    isPassiveIncome: row.isPassiveIncome,
    suggestedClassification: row.suggestedClassification,
    archived: row.archived,
  }
}

/* -------------------------------------------------------------------------
 * StatementBlock
 * ---------------------------------------------------------------------- */

export function createStatementBlockRepository(db: BigornaDatabase): {
  reader: StatementBlockReader
  writer: StatementBlockWriter
} {
  const reader: StatementBlockReader = {
    async findById(userId: UserId, id: BlockId) {
      const row = db
        .select()
        .from(statementBlocks)
        .where(and(eq(statementBlocks.userId, userId), eq(statementBlocks.id, id)))
        .get()
      return row ? toStatementBlock(row) : null
    },

    async list(userId: UserId, page?: Page) {
      const query = db
        .select()
        .from(statementBlocks)
        .where(eq(statementBlocks.userId, userId))
        .orderBy(asc(statementBlocks.order))
      const rows =
        page === undefined ? query.all() : query.limit(page.limit).offset(page.offset).all()
      return rows.map(toStatementBlock)
    },

    async count(userId: UserId) {
      const row = db
        .select({ total: sql<number>`count(*)` })
        .from(statementBlocks)
        .where(eq(statementBlocks.userId, userId))
        .get()
      return row?.total ?? 0
    },
  }

  const writer: StatementBlockWriter = {
    // Onboarding writes the whole reference chart at once (DEFAULT_BLOCKS);
    // re-running it (e.g. a retried step) must not fail on the primary key, so
    // this upserts instead of inserting blindly.
    //
    // ONE transaction, not one per row: the 10 blocks are the DRE cascade, and
    // half of them is not a smaller chart — it is a broken one. Every read of
    // the cascade with a block missing throws `income_statement.missing_block`,
    // which `src/api/http.ts` maps to 500 because it means the STORED data is
    // inconsistent. Measured before this wrapper existed: a seed that failed on
    // the 3rd of 4 categories left the first 2 rows committed.
    async seed(userId: UserId, blocks: readonly StatementBlock[]) {
      if (blocks.length === 0) return []
      db.transaction((tx) => {
        for (const block of blocks) {
          tx.insert(statementBlocks)
            .values({ userId, ...block })
            .onConflictDoUpdate({
              target: [statementBlocks.userId, statementBlocks.id],
              set: {
                name: block.name,
                order: block.order,
                effect: block.effect,
                belowTheLine: block.belowTheLine,
                acceptsUserCategories: block.acceptsUserCategories,
                statementLabel: block.statementLabel,
              },
            })
            .run()
        }
      })
      return reader.list(userId)
    },

    async replace(userId: UserId, block: StatementBlock) {
      const result = db
        .update(statementBlocks)
        .set({
          name: block.name,
          order: block.order,
          effect: block.effect,
          belowTheLine: block.belowTheLine,
          acceptsUserCategories: block.acceptsUserCategories,
          statementLabel: block.statementLabel,
        })
        .where(and(eq(statementBlocks.userId, userId), eq(statementBlocks.id, block.id)))
        .run()
      // ADR-0008 §3: a block id that is not this user's updates zero rows —
      // the row is treated as absent, never silently written to someone else's scope.
      if (result.changes === 0) {
        throw new Error('chart_of_accounts.unknown_block')
      }
      return block
    },
  }

  return { reader, writer }
}

/* -------------------------------------------------------------------------
 * Category
 * ---------------------------------------------------------------------- */

export function createCategoryRepository(db: BigornaDatabase): {
  reader: CategoryReader
  writer: CategoryWriter
} {
  const reader: CategoryReader = {
    async findById(userId: UserId, id: CategoryId) {
      const row = db
        .select()
        .from(categories)
        .where(and(eq(categories.userId, userId), eq(categories.id, id)))
        .get()
      return row ? toCategory(row) : null
    },

    async list(userId: UserId, page?: Page) {
      // No `position` column exists (schema.ts): `rowid` is SQLite's own
      // insertion order and is what stands in for "the reference order of the
      // PRD" once a row round-trips through storage — the same order
      // `DEFAULT_CATEGORIES` ships in, and the one a new category is appended
      // after (rules.ts `categoriesOfBlock`).
      const query = db
        .select()
        .from(categories)
        .where(eq(categories.userId, userId))
        .orderBy(sql`rowid`)
      const rows =
        page === undefined ? query.all() : query.limit(page.limit).offset(page.offset).all()
      return rows.map(toCategory)
    },

    async count(userId: UserId) {
      const row = db
        .select({ total: sql<number>`count(*)` })
        .from(categories)
        .where(eq(categories.userId, userId))
        .get()
      return row?.total ?? 0
    },

    async listByBlock(userId: UserId, blockId: BlockId) {
      const rows = db
        .select()
        .from(categories)
        .where(and(eq(categories.userId, userId), eq(categories.blockId, blockId)))
        .orderBy(sql`rowid`)
        .all()
      return rows.map(toCategory)
    },

    async listActive(userId: UserId) {
      const rows = db
        .select()
        .from(categories)
        .where(and(eq(categories.userId, userId), eq(categories.archived, false)))
        .orderBy(sql`rowid`)
        .all()
      return rows.map(toCategory)
    },
  }

  const writer: CategoryWriter = {
    // Ids are assigned by the writer, never by the caller (src/data/contracts/common.ts):
    // the domain's `createCategory` validates with a scratch id, and this is
    // where the category actually gets the one that will outlive the request.
    async create(userId: UserId, category: NewCategory) {
      const id = randomUUID()
      db.insert(categories)
        .values({ userId, id, ...category })
        .run()
      return { id: asId<CategoryId>(id), ...category }
    },

    async replace(userId: UserId, category: Category) {
      const result = db
        .update(categories)
        .set({
          blockId: category.blockId,
          name: category.name,
          isSystem: category.isSystem,
          isPassiveIncome: category.isPassiveIncome,
          suggestedClassification: category.suggestedClassification,
          archived: category.archived,
        })
        .where(and(eq(categories.userId, userId), eq(categories.id, category.id)))
        .run()
      if (result.changes === 0) {
        throw new Error('chart_of_accounts.unknown_category')
      }
      return category
    },

    // One transaction for the same reason `StatementBlockWriter.seed` uses one:
    // the reference chart is written whole or not at all, so a failed
    // onboarding step never leaves a person with a partial Plano de Contas.
    async seed(userId: UserId, seeded: readonly Category[]) {
      if (seeded.length === 0) return []
      db.transaction((tx) => {
        for (const category of seeded) {
          tx.insert(categories)
            .values({ userId, ...category })
            .onConflictDoUpdate({
              target: [categories.userId, categories.id],
              set: {
                blockId: category.blockId,
                name: category.name,
                isSystem: category.isSystem,
                isPassiveIncome: category.isPassiveIncome,
                suggestedClassification: category.suggestedClassification,
                archived: category.archived,
              },
            })
            .run()
        }
      })
      return reader.list(userId)
    },
  }

  return { reader, writer }
}
