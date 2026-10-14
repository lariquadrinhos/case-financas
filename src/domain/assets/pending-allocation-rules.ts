/**
 * "Direcionar agora" — resolving a Pendente de Direcionamento (files_design/01
 * §13, files_design/03 "Pendente de Direcionamento").
 *
 * Kept in its own file rather than folded into a general `assets/rules.ts`:
 * this is the one rule the Pendências card needs from the Patrimônio context,
 * and it is small enough that it should not force a reviewer of the sale/
 * amortisation rules to also read the Pendências ones.
 *
 * files_design/01 §13 says the action "abre a mesma escolha de conta que
 * aparecia no modal de venda" — the same `Allocation` list the venda uses. What
 * no source spells out is whether resolving is all-or-nothing or lets money
 * trickle in over several visits. `PENDING_ALLOCATION_STATUSES` is a closed
 * two-state enum (`Pending` / `Allocated`) with no partial state and no
 * "amount remaining" field on the record itself, so this rule reads that as
 * the answer: one resolution, covering the whole pending amount exactly.
 */

import { add } from '@/domain/core'
import type { Cents } from '@/domain/core'
import type { Allocation, PendingAllocation } from './types'

export function sumAllocations(allocations: readonly Allocation[]): Cents {
  return add(...allocations.map((allocation) => allocation.amount))
}

/**
 * Turns a `Pending` item into `Allocated`. Refuses anything that would leave
 * the sources disagreeing about how much money moved:
 *  - an already-resolved item cannot be resolved again (files_design/03: the
 *    status is binary, "Direcionado" is a terminal state here);
 *  - the allocations must sum to EXACTLY the pending amount, per the reading
 *    above — neither leaving a silent remainder nor allocating more than the
 *    money that actually exists.
 */
export function directPendingAllocation(
  pending: PendingAllocation,
  allocations: readonly Allocation[],
): PendingAllocation {
  if (pending.status !== 'Pending') {
    throw new Error('pending_allocation.already_allocated')
  }
  if (allocations.length === 0) {
    throw new Error('pending_allocation.no_allocations')
  }
  if (sumAllocations(allocations) !== pending.amount) {
    throw new Error('pending_allocation.allocations_do_not_match_amount')
  }
  return { ...pending, status: 'Allocated' }
}
