'use client'

/**
 * "Destinar o Lucro" — files_design/01 §9, PRD UC6. Read/save hooks for
 * `DestinarOLucroDialog`, over `@/lib/profit-allocation-client`.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Month } from '@/domain/core'
import type { AllocationBucket, AllocationItem } from '@/domain/profit-allocation'
import { fetchProfitAllocation, saveProfitAllocation } from '@/lib/profit-allocation-client'

export function useProfitAllocationQuery(month: Month | null, enabled: boolean) {
  return useQuery({
    queryKey: ['profit-allocation', month],
    queryFn: () => fetchProfitAllocation(month as Month),
    enabled: enabled && month !== null,
  })
}

export function useSaveProfitAllocation(month: Month | null) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (items: Readonly<Record<AllocationBucket, readonly AllocationItem[]>>) =>
      saveProfitAllocation(month as Month, items),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['profit-allocation', month] })
      // The card on the DRE and the Pendência on the Home both derive from
      // what this just changed (Lucro Líquido card disappears/updates; a
      // leftover shows up there as "Saldo não alocado").
      client.invalidateQueries({ queryKey: ['income-statement'] })
      client.invalidateQueries({ queryKey: ['pending-items'] })
    },
  })
}
