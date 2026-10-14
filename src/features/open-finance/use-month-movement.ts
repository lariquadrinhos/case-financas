'use client'

import { useQuery } from '@tanstack/react-query'
import type { ListEnvelope } from '@/api/http'
import { apiGet } from '@/lib/api-client'

/**
 * Entradas − saídas do extrato do mês por Conta Bancária vinculada — o que o
 * "Caixa do mês" desconta do saldo de hoje para chegar ao dia 1º (2026-10-09).
 * Lê o provedor: cinco minutos de cache, e sem repetir se ele falhar.
 */
export function useMonthMovement(month: string) {
  return useQuery({
    queryKey: ['open-finance', 'month-movement', month] as const,
    queryFn: () =>
      apiGet<ListEnvelope<{ bankAccountId: string; movement: number }>>(
        '/open-finance/month-movement',
        { month },
      ),
    staleTime: 5 * 60_000,
    retry: false,
  })
}
