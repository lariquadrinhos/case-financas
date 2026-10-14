'use client'

/**
 * Data hooks for Revisão de Recorrentes (files_design/01 §6, PRD UC25/UC26).
 *
 * Wire types are inferred straight from the Zod schemas in
 * `src/api/contracts/*` — never hand-duplicated — so a field added to a
 * contract shows up here as a type error instead of a silent drift (the same
 * convention `src/features/plano-de-contas-e-patrimonio/types.ts` and
 * `src/app/(app)/inicio/_lib/queries.ts` already use).
 *
 * The screen combines FOUR resources the backend never joins for it
 * (occurrences, recurrences, categories, statement blocks) plus a fifth,
 * per-liability one (installments) — files_design/01 §6 is explicit that
 * "Parcelas de Passivo também aparecem nesta lista, no mesmo formato": the
 * join is a display decision, not a new backend read model.
 */

import { useQueries, useQuery } from '@tanstack/react-query'
import type { z } from 'zod'
import { apiGet } from '@/lib/api-client'
import type { occurrenceSchema, recurrenceSchema } from '@/api/contracts/recurrences'
import type { categorySchema, statementBlockSchema } from '@/api/contracts/chart-of-accounts'
import type { liabilitySchema, installmentSchema } from '@/api/contracts/liabilities'
import type { Month } from '@/domain/core'

interface ListEnvelope<T> {
  data: T[]
  meta: { total: number }
}

export type Occurrence = z.infer<typeof occurrenceSchema>
export type Recurrence = z.infer<typeof recurrenceSchema>
export type Category = z.infer<typeof categorySchema>
export type StatementBlock = z.infer<typeof statementBlockSchema>
export type Liability = z.infer<typeof liabilitySchema>
export type Installment = z.infer<typeof installmentSchema>

export function occurrencesQueryKey(month: Month) {
  return ['occurrences', month] as const
}

/**
 * `GET /occurrences?month=` also materialises the month's occurrences
 * server-side (src/app/api/v1/occurrences/route.ts) — the read IS the write
 * that makes the checklist exist, so this is not merely a cache-friendly read.
 */
export function useOccurrences(month: Month | null) {
  return useQuery({
    queryKey: occurrencesQueryKey(month ?? ('' as Month)),
    queryFn: () => apiGet<ListEnvelope<Occurrence>>('/occurrences', { month: month as string }),
    enabled: month !== null,
  })
}

/** `includeClosed=true`: a past month can still show an occurrence whose série has since been encerrada. */
export function useRecurrences() {
  return useQuery({
    queryKey: ['recurrences', 'all'],
    queryFn: () => apiGet<ListEnvelope<Recurrence>>('/recurrences', { includeClosed: 'true' }),
    staleTime: 60_000,
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories', 'all'],
    queryFn: () => apiGet<ListEnvelope<Category>>('/categories', { includeArchived: 'true' }),
    staleTime: 5 * 60_000,
  })
}

export function useStatementBlocks() {
  return useQuery({
    queryKey: ['statement-blocks'],
    queryFn: () => apiGet<ListEnvelope<StatementBlock>>('/statement-blocks'),
    staleTime: 5 * 60_000,
  })
}

export function useLiabilities() {
  return useQuery({
    queryKey: ['liabilities', 'all'],
    queryFn: () => apiGet<ListEnvelope<Liability>>('/liabilities'),
    staleTime: 60_000,
  })
}

/**
 * One `/liabilities/{id}/installments` call per Passivo, run in parallel —
 * there is no bulk endpoint (the schedule is scoped to one Passivo, files_design/03),
 * so joining across every debt for a single month is this screen's own job.
 */
export function useInstallmentsByLiability(liabilityIds: readonly string[]) {
  const results = useQueries({
    queries: liabilityIds.map((id) => ({
      queryKey: ['liabilities', id, 'installments'],
      queryFn: () => apiGet<ListEnvelope<Installment>>(`/liabilities/${id}/installments`),
      staleTime: 30_000,
    })),
  })

  const isLoading = results.some((result) => result.isLoading)
  const isError = results.some((result) => result.isError)
  const byLiability: Record<string, Installment[]> = {}
  liabilityIds.forEach((id, index) => {
    byLiability[id] = results[index]?.data?.data ?? []
  })

  return { byLiability, isLoading, isError }
}
