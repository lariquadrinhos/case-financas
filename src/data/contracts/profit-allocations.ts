/**
 * Destinar o Lucro. Keyed by MONTH, not by an id: there is exactly one
 * allocation per month (PRD UC6), so `Month` is the identity and there is no
 * `findById`.
 */

import type { ProfitAllocation } from '@/domain/profit-allocation'
import type { Month } from '@/domain/core'
import type { UserId } from './common'

export interface ProfitAllocationReader {
  findByMonth(userId: UserId, month: Month): Promise<ProfitAllocation | null>
  listByMonths(userId: UserId, months: readonly Month[]): Promise<readonly ProfitAllocation[]>
  /**
   * Every month with a saved Destinação, oldest first. The Home's unified
   * Pendências list (H13, `@/domain/pending-items`) has no other way to find
   * which months might still have a saldo não alocado — `pendingItemFor` is a
   * pure function over one `ProfitAllocation`, but something has to say WHICH
   * ones to check.
   */
  listAll(userId: UserId): Promise<readonly ProfitAllocation[]>
}

/**
 * `save` is an upsert on the month, and it replaces the item lists wholesale:
 * the screen edits four cards and submits them together, and an item removed
 * from a card must disappear rather than survive as an orphan.
 */
export interface ProfitAllocationWriter {
  save(userId: UserId, allocation: ProfitAllocation): Promise<ProfitAllocation>
}
