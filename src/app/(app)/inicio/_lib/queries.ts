'use client'

/**
 * Data hooks for the Home dashboard, one per card, each a thin
 * `useQuery` over the real `/api/v1/*` contracts (src/api/contracts) — no
 * screen invents its own aggregation endpoint.
 *
 * Two cards have no dedicated report of their own (Entradas e Saídas, Onde
 * Está Meu Dinheiro): the DRE and the Balanço Patrimonial reports already
 * compute exactly the numbers those cards need, so they read from
 * `income-statement` and `balance-sheet` respectively instead of refetching
 * and re-deriving raw Lançamentos on the client (docs/ARCHITECTURE.md §1: a
 * report is a projection, computed once, in one place).
 */

import { useQuery } from '@tanstack/react-query'
import type { LeftoverDirection } from '@/domain/discretionary-spending'
import type { z } from 'zod'
import { ApiError, apiGet } from '@/lib/api-client'
import type { pendingItemSchema } from '@/api/contracts/pending-items'
import type { incomeStatementSchema } from '@/api/contracts/reports'
import type { balanceSheetSchema } from '@/api/contracts/reports'
import type { entrySchema } from '@/api/contracts/entries'
import type { categorySchema } from '@/api/contracts/chart-of-accounts'
import type {
  discretionarySpendingConfigSchema,
  discretionaryExpenseSchema,
} from '@/api/contracts/discretionary-spending'
import type { traceEventSchema } from '@/api/contracts/trace-events'
import type { bankAccountSchema } from '@/api/contracts/bank-accounts'
import type { investmentSchema } from '@/api/contracts/investments'
import type { liabilitySchema } from '@/api/contracts/liabilities'
import type { recurrenceSchema } from '@/api/contracts/recurrences'
import type { IsoDate, Month, View } from '@/domain/core'

interface ListEnvelope<T> {
  data: T[]
  meta: { total: number }
}

export type PendingItem = z.infer<typeof pendingItemSchema>
export type IncomeStatement = z.infer<typeof incomeStatementSchema>
export type BalanceSheet = z.infer<typeof balanceSheetSchema>
export type Entry = z.infer<typeof entrySchema>
export type Category = z.infer<typeof categorySchema>
export type DiscretionarySpendingConfig = z.infer<typeof discretionarySpendingConfigSchema>
export type DiscretionaryExpense = z.infer<typeof discretionaryExpenseSchema>
export type TraceEvent = z.infer<typeof traceEventSchema>
export type BankAccount = z.infer<typeof bankAccountSchema>
export type Investment = z.infer<typeof investmentSchema>
export type Liability = z.infer<typeof liabilitySchema>
export type Recurrence = z.infer<typeof recurrenceSchema>

export function usePendingItems() {
  return useQuery({
    queryKey: ['pending-items'],
    queryFn: () => apiGet<ListEnvelope<PendingItem>>('/pending-items'),
  })
}

/** Entradas e Saídas — the DRE's own numbers, re-read as "in/out" (files_design/08 §5). */
export function useCashFlow(month: Month, view: View, statusFilter: 'Paid' | 'Planned') {
  return useQuery({
    queryKey: ['income-statement', month, view, statusFilter],
    queryFn: () =>
      apiGet<IncomeStatement>('/reports/income-statement', { month, view, statusFilter }),
  })
}

/** Onde Está Meu Dinheiro — the Balanço's own items, split into ativos líquidos / dívidas. */
export function useMoneyMap(asOf: IsoDate) {
  return useQuery({
    queryKey: ['balance-sheet', asOf],
    queryFn: () => apiGet<BalanceSheet>('/reports/balance-sheet', { view: 'Consolidated', asOf }),
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => apiGet<ListEnvelope<Category>>('/categories'),
    staleTime: 5 * 60_000,
  })
}

/** Despesas por Categoria — Lançamentos de Despesa, pagos, do mês, agrupados por categoria. */
export function useMonthlyExpenses(month: Month) {
  return useQuery({
    queryKey: ['entries', 'expenses', month],
    queryFn: () =>
      apiGet<ListEnvelope<Entry>>('/entries', {
        month,
        status: 'Paid',
        view: 'Consolidated',
        limit: 500,
      }),
  })
}

export function useDiscretionarySpendingConfig() {
  return useQuery({
    queryKey: ['discretionary-spending', 'config'],
    queryFn: async () => {
      try {
        return await apiGet<DiscretionarySpendingConfig>('/discretionary-spending/config')
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
      }
    },
  })
}

export function useDiscretionaryExpenses(month: Month) {
  return useQuery({
    queryKey: ['discretionary-spending', 'expenses', month],
    queryFn: () =>
      apiGet<ListEnvelope<DiscretionaryExpense>>('/discretionary-spending/expenses', { month }),
  })
}

export function useBankAccounts() {
  return useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => apiGet<ListEnvelope<BankAccount>>('/bank-accounts'),
    staleTime: 5 * 60_000,
  })
}

export function useInvestments() {
  return useQuery({
    queryKey: ['investments'],
    queryFn: () => apiGet<ListEnvelope<Investment>>('/investments'),
    staleTime: 5 * 60_000,
  })
}

/**
 * Detalhe do Bloco, campo "Para onde" — a busca oferece "conta, investimento
 * ou dívida" (Figma 345:252, placeholder 189:48; nota 189:55 e Mockup
 * 1002:3146: "qualquer outro bloco do mapa (Contas, Dívidas, outro
 * Investimento)"). Mesma queryKey `['liabilities']` de
 * `createResourceHooks('liabilities')`
 * (src/features/plano-de-contas-e-patrimonio/use-resource.ts), pra Passivo
 * cadastrado na tela de Passivos já entrar aqui sem uma segunda cópia em
 * cache.
 */
export function useLiabilities() {
  return useQuery({
    queryKey: ['liabilities'],
    queryFn: () => apiGet<ListEnvelope<Liability>>('/liabilities'),
    staleTime: 5 * 60_000,
  })
}

/**
 * Detalhe da Categoria / Detalhe do Consumo Livre — "Lançamentos deste mês"
 * daquela categoria (files_design/01 §13), a mesma lista/filtro do Histórico
 * (`entryQuerySchema`), não uma consulta paralela.
 */
export function useEntriesByCategory(month: Month, categoryId: string) {
  return useQuery({
    queryKey: ['entries', 'category', month, categoryId],
    queryFn: () =>
      apiGet<ListEnvelope<Entry>>('/entries', { month, categoryId, view: 'Consolidated' }),
    enabled: categoryId.length > 0,
  })
}

/** Pendências, tipo "Recorrência sem valor definido" — a Ocorrência não carrega a Categoria, só o template da Recorrência tem. */
export function useRecurrence(id: string | undefined) {
  return useQuery({
    queryKey: ['recurrences', id],
    queryFn: () => apiGet<Recurrence>(`/recurrences/${id}`),
    enabled: id !== undefined,
    retry: false,
  })
}

export function useRecentEvents() {
  return useQuery({
    queryKey: ['trace-events', 'recent'],
    // files_design/08 §9.3: only the last 5.
    queryFn: () => apiGet<ListEnvelope<TraceEvent>>('/trace-events', { limit: 5 }),
  })
}

/**
 * Os direcionamentos da sobra (P14). A tela usa só para saber quanto voltou
 * para a verba deste mês — `leftoverBroughtForward` filtra o destino.
 */
export function useLeftoverDirections() {
  return useQuery({
    queryKey: ['leftover-directions'],
    queryFn: () => apiGet<ListEnvelope<LeftoverDirection>>('/leftover-directions'),
    staleTime: 60_000,
  })
}
