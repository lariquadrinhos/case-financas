'use client'

/**
 * The one slice of `/api/v1/entries` this group's screens need: creating a
 * Receita from inside "Vender Bem Material" → Direcionamento → Receita
 * (files_design/01 §11 — "abre o formulário de Receita já existente"). Novo
 * Lançamento itself (files_design/01 §5) belongs to a different group; this
 * file does not reimplement it, only the one create call this screen borrows.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { apiPost } from '@/lib/api-client'
import { newEntryVariants, type entrySchema } from '@/api/contracts/entries'

export type Entry = z.infer<typeof entrySchema>
// `z.input`: o corpo enviado, com os padrões ainda opcionais (o servidor os
// aplica). Com `z.infer`, cada campo novo com padrão — "Cartão de crédito",
// 2026-10-09 — obrigava este chamador a repeti-lo.
export type NewRevenueEntry = z.input<typeof newEntryVariants.Revenue>

export function useCreateRevenueEntry() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: NewRevenueEntry) => apiPost<Entry>('/entries', body),
    // Nothing on this group's screens lists lançamentos, so there is no cache
    // to invalidate here — Histórico (another group) reads it fresh on visit.
    onSuccess: () => client.invalidateQueries({ queryKey: ['entries'] }),
  })
}
