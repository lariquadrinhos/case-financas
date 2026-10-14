/**
 * The border check that a Lançamento sits in a block that accepts its kind
 * (`blockAcceptsKind`, src/domain/chart-of-accounts/rules.ts). Here and not in
 * the pure `Entry` rules because the answer needs the stored chart: which
 * block the category lives in, and that block's cascade effect.
 */

import { blockAcceptsKind } from '@/domain/chart-of-accounts'
import type { NewEntry } from '@/domain/entries'
import type { Repositories } from '@/data'
import type { UserId } from '@/data/contracts/common'

export async function assertCategoryFitsKind(
  repos: Pick<Repositories, 'categoryReader' | 'statementBlockReader'>,
  userId: UserId,
  entry: Pick<NewEntry, 'kind'> & { categoryId?: string },
): Promise<void> {
  if ((entry.kind !== 'Expense' && entry.kind !== 'Revenue') || entry.categoryId === undefined) {
    return
  }
  const category = await repos.categoryReader.findById(userId, entry.categoryId as never)
  if (category === null) return // the RESTRICT foreign key answers 404 on write
  const blocks = await repos.statementBlockReader.list(userId)
  const block = blocks.find((b) => b.id === category.blockId)
  if (block !== undefined && !blockAcceptsKind(block.effect, entry.kind)) {
    throw new Error('entries.category_kind_mismatch')
  }
}
