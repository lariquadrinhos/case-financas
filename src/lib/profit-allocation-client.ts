'use client'

/**
 * Client-side access to `/api/v1/profit-allocations/{month}` — same boundary
 * convention as `@/lib/reports-client`: parse with the same Zod schema the
 * route is typed against, never cast the raw `fetch` result.
 *
 * `GET` 404s when nothing was saved for the month yet (`route.ts`'s own
 * doc comment) — that is not an error here, it is the starting state for a
 * month nobody has destined yet, so it resolves to `null` instead of
 * rejecting.
 */

import { apiGet, apiPut, ApiError } from '@/lib/api-client'
import { profitAllocationSchema } from '@/api/contracts/profit-allocations'
import type { AllocationBucket, AllocationItem, ProfitAllocation } from '@/domain/profit-allocation'

export async function fetchProfitAllocation(month: string): Promise<ProfitAllocation | null> {
  try {
    const payload = await apiGet<unknown>(`/profit-allocations/${month}`)
    return profitAllocationSchema.parse(payload) as unknown as ProfitAllocation
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export async function saveProfitAllocation(
  month: string,
  items: Readonly<Record<AllocationBucket, readonly AllocationItem[]>>,
): Promise<ProfitAllocation> {
  const payload = await apiPut<unknown>(`/profit-allocations/${month}`, { items })
  return profitAllocationSchema.parse(payload) as unknown as ProfitAllocation
}
