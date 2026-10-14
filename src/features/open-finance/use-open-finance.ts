'use client'

/**
 * Client hooks for `/api/v1/open-finance` (ADR-0020). A link or a sync
 * changes balances and Lançamentos, so both invalidate every query: the list
 * of what a sync can touch is most of the app.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api-client'
import type { ListEnvelope } from '@/api/http'

export type OpenFinanceAccountKind = 'Checking' | 'CreditCard' | 'Investment'

export type OpenFinanceLinkTarget =
  | { kind: 'BankAccount'; bankAccountId: string }
  | { kind: 'CreditCard'; paidByBankAccountId: string }
  | { kind: 'Investment'; investmentId: string }

export interface OpenFinanceAccount {
  readonly id: string
  readonly kind: OpenFinanceAccountKind
  readonly name: string
  readonly numberSuffix: string | null
  readonly institution: string | null
  readonly balance: number
  readonly link: { readonly target: OpenFinanceLinkTarget; readonly linkedOn: string } | null
}

export type SyncResult =
  | { status: 'Synced'; balancesUpdated: number; imported: Record<string, number> }
  | { status: 'Skipped'; lastSyncedAt: string }
  | { status: 'Paused' }

const KEY = ['open-finance', 'accounts'] as const

export function useOpenFinanceAccounts() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiGet<ListEnvelope<OpenFinanceAccount>>('/open-finance/accounts'),
    // "Não configurado" é um estado estável, não uma falha a repetir.
    retry: false,
  })
}

export interface AccountMovement {
  readonly id: string
  readonly date: string
  readonly description: string
  readonly amount: number
  readonly direction: 'In' | 'Out'
  readonly providerCategory: string | null
  readonly outcome: string | null
}

/** Os movimentos do mês de uma conta — buscados só quando a linha é expandida. */
export function useOpenFinanceAccountMovements(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ['open-finance', 'movements', id] as const,
    queryFn: () =>
      apiGet<ListEnvelope<AccountMovement>>(
        `/open-finance/accounts/${encodeURIComponent(id)}/transactions`,
      ),
    enabled,
  })
}

export function useOpenFinanceSyncStatus() {
  return useQuery({
    queryKey: ['open-finance', 'sync-status'] as const,
    queryFn: () => apiGet<{ lastSyncedAt: string | null; autoSync: boolean }>('/open-finance/sync'),
  })
}

/** "Sincronizar ao abrir o app" (2026-10-01). */
export function useSetOpenFinanceAutoSync() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (enabled: boolean) => apiPut('/open-finance/auto-sync', { enabled }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['open-finance', 'sync-status'] }),
  })
}

export function useLinkOpenFinanceAccount() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, target }: { id: string; target: OpenFinanceLinkTarget | null }) =>
      target === null
        ? apiDelete(`/open-finance/links/${encodeURIComponent(id)}`)
        : apiPut(`/open-finance/links/${encodeURIComponent(id)}`, { target }),
    onSuccess: () => client.invalidateQueries(),
  })
}

/** "Reimportar": desfaz o que a importação criou e importa de novo. */
export function useReimportOpenFinance() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost<SyncResult>('/open-finance/reimport', {}),
    onSuccess: () => client.invalidateQueries(),
  })
}

export function useSyncOpenFinance() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (force: boolean) => apiPost<SyncResult>('/open-finance/sync', { force }),
    onSuccess: (result) => {
      if (result.status === 'Synced') void client.invalidateQueries()
    },
  })
}

/** "Criar e vincular": a posição nasce com o nome e o saldo do banco. */
export function useCreatePositionFromBank() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, entity }: { id: string; entity: 'PF' | 'PJ' }) =>
      apiPost(`/open-finance/links/${encodeURIComponent(id)}/position`, { entity }),
    onSuccess: () => client.invalidateQueries(),
  })
}
