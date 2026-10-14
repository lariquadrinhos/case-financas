'use client'

import { useQuery } from '@tanstack/react-query'
import type { ListEnvelope } from '@/api/http'
import { apiGet } from '@/lib/api-client'
import type { Entry, HistoricoFilters } from './types'

function toQuery(filters: HistoricoFilters) {
  return {
    status: filters.status || undefined,
    view: filters.view || undefined,
    month: filters.month || undefined,
    categoryId: filters.categoryId || undefined,
    classification: filters.classification || undefined,
    bankAccountId: filters.bankAccountId || undefined,
    recurring: filters.recurring || undefined,
    limit: 500,
  }
}

/**
 * `GET /entries` with the seven Histórico filters (files_design/03). The
 * limit of 500 covers the realistic size of a single-person ledger for this
 * phase (ADR-0007 §1: local, single-user) without adding pagination UI the
 * screens spec never asks for.
 */
export function useHistoricoEntries(filters: HistoricoFilters) {
  return useQuery({
    queryKey: ['entries', 'historico', filters],
    queryFn: () => apiGet<ListEnvelope<Entry>>('/entries', toQuery(filters)),
  })
}
