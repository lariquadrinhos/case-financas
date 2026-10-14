'use client'

/**
 * Data hooks for Novo Lançamento — thin `useQuery`/`useMutation` wrappers over
 * the real `/api/v1/*` contracts, exactly as `src/features/plano-de-contas-e-
 * patrimonio/use-resource.ts` already does for its own screens. No screen
 * invents a parallel form of the backend: creating an entry with a Recorrência
 * ligada MUST go through `POST /entries` (not a repository call) because that
 * route is the one place that also creates the `Recurrence` template
 * (`src/app/api/v1/entries/route.ts`).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ListEnvelope } from '@/api/http'
import { apiGet, apiPatch, apiPost } from '@/lib/api-client'
import type { Entity } from '@/domain/core'
import type { EditScope, Occurrence, Recurrence } from '@/domain/recurrence'
import type {
  BankAccount,
  Category,
  Entry,
  EntryPatch,
  NewCategory,
  NewEntry,
  StatementBlock,
} from './types'

export function useBankAccounts(entity?: Entity) {
  return useQuery({
    queryKey: ['bank-accounts', entity ?? 'all'],
    queryFn: () => apiGet<ListEnvelope<BankAccount>>('/bank-accounts', { entity }),
    staleTime: 60_000,
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => apiGet<ListEnvelope<Category>>('/categories'),
    staleTime: 60_000,
  })
}

/**
 * As categorias INCLUINDO as arquivadas — para FILTRAR histórico, nunca para
 * escolher onde lançar.
 *
 * `includeArchived` nasce `false` porque a tela que oferece categoria lista o
 * que é usável (`categoryQuerySchema`). Um filtro de Histórico não é essa tela:
 * ele olha para trás, e uma categoria arquivada continua tendo lançamentos que
 * contam no DRE — arquivar esconde a categoria das listas, não apaga o passado
 * dela.
 *
 * Sem isso, os lançamentos de uma categoria descartada ficam **impossíveis de
 * filtrar**: aparecem no total e não são encontráveis. A P11 (produto,
 * 2026-09-08) decidiu que recriar uma categoria arquivada cria um registro
 * novo, o que torna esse caso comum — passa a haver duas "Academia", e sem esta
 * consulta a metade antiga some do filtro.
 */
export function useCategoriesIncludingArchived() {
  return useQuery({
    queryKey: ['categories', 'including-archived'],
    queryFn: () => apiGet<ListEnvelope<Category>>('/categories', { includeArchived: 'true' }),
    staleTime: 60_000,
  })
}

/** The 10 fixed blocks — needed only to let the person pick one when creating a category inline. */
export function useStatementBlocks() {
  return useQuery({
    queryKey: ['statement-blocks'],
    queryFn: () => apiGet<ListEnvelope<StatementBlock>>('/statement-blocks'),
    staleTime: 5 * 60_000,
  })
}

export function useCreateCategory() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: NewCategory) => apiPost<Category>('/categories', body),
    onSuccess: () => client.invalidateQueries({ queryKey: ['categories'] }),
  })
}

/** Only used in edit mode — the person arrived from the Histórico. */
export function useEntry(id: string | null) {
  return useQuery({
    queryKey: ['entries', id],
    queryFn: () => apiGet<Entry>(`/entries/${id}`),
    enabled: id !== null,
  })
}

export function useCreateEntry() {
  const client = useQueryClient()
  return useMutation({
    // ADR-0019: um recorrente Previsto vira OCORRÊNCIA, não lançamento — e
    // todo lançamento recorrente cria série e ocorrência. Invalidar só
    // `entries` deixava a Revisão de Recorrentes e os relatórios com o dado velho.
    mutationFn: (body: NewEntry) => apiPost<unknown>('/entries', body),
    onSuccess: () => client.invalidateQueries(),
  })
}

export function usePatchEntry() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: EntryPatch }) =>
      apiPatch<Entry>(`/entries/${id}`, body),
    // Tudo, como `useCreateEntry`: uma edição muda o DRE, a Home e os
    // relatórios da tela de onde a pessoa veio. Medido em 2026-10-06: só
    // `['entries']` era invalidado, e o DRE voltava com o valor antigo.
    onSuccess: () => client.invalidateQueries(),
  })
}

/**
 * O mês de uma série e a série dele, para o formulário "Editar Recorrência"
 * (2026-10-01). Duas leituras em sequência: a ocorrência diz qual é a série.
 */
export function useSeriesMonth(occurrenceId: string | null) {
  return useQuery({
    queryKey: ['occurrences', 'for-edit', occurrenceId],
    enabled: occurrenceId !== null,
    queryFn: async () => {
      const occurrence = await apiGet<Occurrence>(`/occurrences/${occurrenceId}`)
      const recurrence = await apiGet<Recurrence>(`/recurrences/${occurrence.recurrenceId}`)
      return { occurrence, recurrence }
    },
  })
}

export interface SeriesMonthPatch {
  readonly plannedAmount: number
  readonly description: string | null
  readonly scope: EditScope
  readonly template?: Recurrence['template']
}

/** Salva o "Editar Recorrência": `PATCH /occurrences/{id}`. Muda DRE, Revisão e Home. */
export function usePatchSeriesMonth() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: SeriesMonthPatch }) =>
      apiPatch<unknown>(`/occurrences/${id}`, body),
    onSuccess: () => client.invalidateQueries(),
  })
}
