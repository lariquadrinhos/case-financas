'use client'

/**
 * A generic list/create/patch/remove hook set over one `/api/v1` resource,
 * shared by the five screens of this group (Plano de Contas, Contas
 * Bancárias, Bens Materiais, Investimentos, Passivos) — they all follow the
 * exact same shape: `registerResource()` on the server side
 * (`src/api/contracts/common.ts`), so the client side gets to share code too.
 *
 * Each screen gets its own file (`bank-accounts.ts`, `investments.ts`, …)
 * that just calls this factory with its own types — see those files for the
 * concrete hooks a component actually imports.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api-client'
import type { ListEnvelope } from '@/api/http'

type QueryValue = string | number | boolean | undefined

export function createResourceHooks<TItem, TNew, TPatch>(resource: string) {
  const key = [resource] as const

  function useList(query?: Record<string, QueryValue>) {
    return useQuery({
      queryKey: query ? [...key, query] : key,
      queryFn: () => apiGet<ListEnvelope<TItem>>(`/${resource}`, query),
    })
  }

  function useCreate() {
    const client = useQueryClient()
    return useMutation({
      mutationFn: (body: TNew) => apiPost<TItem>(`/${resource}`, body),
      onSuccess: () => client.invalidateQueries({ queryKey: key }),
    })
  }

  function usePatch() {
    const client = useQueryClient()
    return useMutation({
      mutationFn: ({ id, body }: { id: string; body: TPatch }) =>
        apiPatch<TItem>(`/${resource}/${id}`, body),
      onSuccess: () => client.invalidateQueries({ queryKey: key }),
    })
  }

  function useRemove() {
    const client = useQueryClient()
    return useMutation({
      mutationFn: (id: string) => apiDelete(`/${resource}/${id}`),
      onSuccess: () => client.invalidateQueries({ queryKey: key }),
    })
  }

  return { key, useList, useCreate, usePatch, useRemove }
}
