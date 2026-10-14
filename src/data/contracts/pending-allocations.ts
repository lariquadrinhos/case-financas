/**
 * Pendente de Direcionamento — money left over from a sale (files_design/03).
 * The Home shows a banner while any of them is `Pending`.
 */

import type { PendingAllocation, PendingAllocationStatus } from '@/domain/assets'
import type { PendingAllocationId } from '@/domain/core'
import type { Reader, UserId, Writer } from './common'

export type NewPendingAllocation = Omit<PendingAllocation, 'id'>

export interface PendingAllocationReader extends Reader<PendingAllocation, PendingAllocationId> {
  listByStatus(
    userId: UserId,
    status: PendingAllocationStatus,
  ): Promise<readonly PendingAllocation[]>
}

export type PendingAllocationWriter = Writer<
  PendingAllocation,
  NewPendingAllocation,
  PendingAllocationId
>
