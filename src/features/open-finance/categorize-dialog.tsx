'use client'

/**
 * "Categorizar agora" — a ação da Pendência "N lançamentos a categorizar" da
 * Home (PRD v7.46). Lista os lançamentos do mês que ainda estão em
 * "A categorizar", com a descrição real do banco, e o seletor de categoria de
 * cada um. Escolher a categoria tira o lançamento da lista e da Pendência.
 *
 * NÃO ESTÁ NO FIGMA. Usa o Dialog do design system e a mesma lista que o DRE
 * mostra ao abrir uma categoria (`DreCategoryEntries`).
 */

import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loading } from '@/components/patterns/loading'
import {
  UNCATEGORIZED_EXPENSE_CATEGORY_ID,
  UNCATEGORIZED_REVENUE_CATEGORY_ID,
} from '@/domain/chart-of-accounts'
import { formatMonthName, type Month } from '@/domain/core'
import { apiGet } from '@/lib/api-client'
import type { ListEnvelope } from '@/api/http'
import { DreCategoryEntries } from '@/features/relatorios/dre-category-entries'

interface EntryRow {
  readonly id: string
  readonly amount: number
  readonly categoryId?: string
}

function useUncategorized(month: Month | null) {
  return useQuery({
    queryKey: ['entries', 'uncategorized', month] as const,
    enabled: month !== null,
    queryFn: async () => {
      const lists = await Promise.all(
        [UNCATEGORIZED_EXPENSE_CATEGORY_ID, UNCATEGORIZED_REVENUE_CATEGORY_ID].map((categoryId) =>
          apiGet<ListEnvelope<EntryRow>>('/entries', {
            month: month ?? undefined,
            categoryId,
            limit: 500,
          }),
        ),
      )
      return lists.flatMap((l) => l.data)
    },
  })
}

export function CategorizeDialog({
  month,
  onOpenChange,
}: {
  month: Month | null
  onOpenChange: (open: boolean) => void
}) {
  const entries = useUncategorized(month)
  return (
    <Dialog open={month !== null} onOpenChange={onOpenChange}>
      <DialogContent width="list">
        <DialogHeader>
          <DialogTitle>
            Lançamentos a categorizar{month !== null ? ` — ${formatMonthName(month)}` : ''}
          </DialogTitle>
          <DialogDescription>
            Vieram do banco sem categoria. Escolha a categoria de cada um: ele sai desta lista e
            passa a contar na linha certa do DRE.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {entries.isLoading || month === null ? (
            <Loading label="Carregando lançamentos" />
          ) : (entries.data ?? []).length === 0 ? (
            <p className="text-style-body-sm text-ink-secondary">Tudo categorizado neste mês.</p>
          ) : (
            <DreCategoryEntries
              month={month}
              items={(entries.data ?? []).map((e) => ({
                entryId: e.id,
                name: 'A categorizar',
                categoryId: e.categoryId ?? null,
                amount: e.amount,
              }))}
            />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
