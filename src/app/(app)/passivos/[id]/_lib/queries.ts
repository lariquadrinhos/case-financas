'use client'

/**
 * Data hooks for Detalhe do Passivo (files_design/01 §12).
 *
 * Wire types are inferred from `src/api/contracts/liabilities` and
 * `src/api/contracts/trace-events` — the same convention as
 * `src/features/plano-de-contas-e-patrimonio/types.ts`, which this screen
 * reuses directly for `Liability`/`Installment` so the two never drift into
 * two different shapes for the same resource.
 */

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import type { Installment, Liability } from '@/features/plano-de-contas-e-patrimonio/types'
import type { z } from 'zod'
import type { traceEventSchema } from '@/api/contracts/trace-events'

interface ListEnvelope<T> {
  data: T[]
  meta: { total: number }
}

export type { Installment, Liability }
export type TraceEvent = z.infer<typeof traceEventSchema>

export function useLiability(id: string) {
  return useQuery({
    queryKey: ['liabilities', id],
    queryFn: () => apiGet<Liability>(`/liabilities/${id}`),
  })
}

export function useLiabilityInstallments(id: string) {
  return useQuery({
    queryKey: ['liabilities', id, 'installments'],
    queryFn: () => apiGet<ListEnvelope<Installment>>(`/liabilities/${id}/installments`),
  })
}

/** files_design/01 §12: "Cada Passivo mostra o seu log completo" — no limit. */
export function useLiabilityTraceEvents(id: string) {
  return useQuery({
    queryKey: ['trace-events', 'liability', id],
    queryFn: () =>
      apiGet<ListEnvelope<TraceEvent>>('/trace-events', { liabilityId: id, limit: 200 }),
  })
}
