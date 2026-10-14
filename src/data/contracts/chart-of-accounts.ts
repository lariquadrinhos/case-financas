/**
 * Plano de Contas — blocks and categories.
 *
 * Blocks have a writer even though the person cannot create one: the 10 come
 * from `DEFAULT_BLOCKS` and are written at onboarding, which is a write. What
 * the person edits is the categories.
 */

import type { Category, StatementBlock } from '@/domain/chart-of-accounts'
import type { BlockId, CategoryId } from '@/domain/core'
import type { Reader, UserId } from './common'

export type NewCategory = Omit<Category, 'id'>

export type StatementBlockReader = Reader<StatementBlock, BlockId>

/** Seeded at onboarding from `DEFAULT_BLOCKS`; never created one at a time by a screen. */
export interface StatementBlockWriter {
  seed(userId: UserId, blocks: readonly StatementBlock[]): Promise<readonly StatementBlock[]>
  replace(userId: UserId, block: StatementBlock): Promise<StatementBlock>
}

export interface CategoryReader extends Reader<Category, CategoryId> {
  listByBlock(userId: UserId, blockId: BlockId): Promise<readonly Category[]>
  /** The screens list what is usable; the Histórico still resolves an archived one by id. */
  listActive(userId: UserId): Promise<readonly Category[]>
}

/**
 * No `remove`: there is no delete for a category (files_design/01 §3.1). The
 * entries already point at it, and archiving is the product's answer.
 */
export interface CategoryWriter {
  create(userId: UserId, category: NewCategory): Promise<Category>
  replace(userId: UserId, category: Category): Promise<Category>
  seed(userId: UserId, categories: readonly Category[]): Promise<readonly Category[]>
}
