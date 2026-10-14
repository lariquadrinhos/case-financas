import { describe, expect, it } from 'vitest'
import { asId, cents, isoDate } from '@/domain/core'
import type {
  AllocationId,
  Cents,
  InvestmentId,
  LiabilityId,
  PendingAllocationId,
  TangibleAssetId,
} from '@/domain/core'
import { directPendingAllocation, sumAllocations } from './pending-allocation-rules'
import type { Allocation, PendingAllocation } from './types'

const ASSET = asId<TangibleAssetId>('carro-antigo')
const INVESTMENT = asId<InvestmentId>('tesouro-direto')
const LIABILITY = asId<LiabilityId>('financiamento-apartamento')

function pending(
  amount: Cents,
  status: PendingAllocation['status'] = 'Pending',
): PendingAllocation {
  return {
    id: asId<PendingAllocationId>('pend-1'),
    origin: { kind: 'TangibleAssetSale', tangibleAssetId: ASSET },
    amount,
    originDate: isoDate('2026-07-10'),
    status,
  }
}

function investmentAllocation(amount: Cents): Allocation {
  return { id: asId<AllocationId>('alloc-1'), kind: 'Investment', target: INVESTMENT, amount }
}

function liabilityAllocation(amount: Cents): Allocation {
  return { id: asId<AllocationId>('alloc-2'), kind: 'Liability', target: LIABILITY, amount }
}

describe('sumAllocations', () => {
  it('adds every allocation amount', () => {
    expect(
      sumAllocations([investmentAllocation(cents(1_000)), liabilityAllocation(cents(500))]),
    ).toBe(1_500)
  })

  it('is zero for an empty list', () => {
    expect(sumAllocations([])).toBe(0)
  })
})

describe('directPendingAllocation — files_design/01 §13, "Direcionar agora"', () => {
  it('resolves a Pending item whose allocations sum to exactly the pending amount', () => {
    const item = pending(cents(1_500))
    const resolved = directPendingAllocation(item, [
      investmentAllocation(cents(1_000)),
      liabilityAllocation(cents(500)),
    ])
    expect(resolved.status).toBe('Allocated')
    expect(resolved.amount).toBe(1_500)
  })

  it('refuses when the allocations sum to LESS than the pending amount', () => {
    // A silent remainder would make the money "moved" reported by this action
    // disagree with the money that actually left the pending pool.
    const item = pending(cents(1_500))
    expect(() => directPendingAllocation(item, [investmentAllocation(cents(1_000))])).toThrow(
      'pending_allocation.allocations_do_not_match_amount',
    )
  })

  it('refuses when the allocations sum to MORE than the pending amount', () => {
    const item = pending(cents(1_500))
    expect(() => directPendingAllocation(item, [investmentAllocation(cents(2_000))])).toThrow(
      'pending_allocation.allocations_do_not_match_amount',
    )
  })

  it('refuses an empty list of allocations', () => {
    expect(() => directPendingAllocation(pending(cents(1_500)), [])).toThrow(
      'pending_allocation.no_allocations',
    )
  })

  it('refuses to re-resolve an item that is already Allocated', () => {
    const item = pending(cents(1_500), 'Allocated')
    expect(() => directPendingAllocation(item, [investmentAllocation(cents(1_500))])).toThrow(
      'pending_allocation.already_allocated',
    )
  })
})
