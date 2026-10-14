'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost } from '@/lib/api-client'
import type { Cents, Month } from '@/domain/core'
import { occurrencesQueryKey } from './queries'
import type { Occurrence } from './queries'

/**
 * "Marcar Pago" on a recorrência occurrence — `POST /occurrences/{id}/payment`
 * (files_design/03 "Marcar Pago"). `overpaymentChoice` is only meaningful
 * above the planned amount (src/app/api/v1/occurrences/[id]/payment/route.ts:
 * accepted by the schema, not yet acted on beyond recording the payment) — it
 * is still sent when chosen, because the field is part of the real contract.
 */
export function useMarkOccurrencePaid(month: Month) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      paidAmount,
      paymentDate,
      overpaymentChoice,
    }: {
      id: string
      paidAmount: Cents
      paymentDate: string
      overpaymentChoice?: 'DeductFromNext' | 'RedirectExtra' | 'NoAction'
    }) =>
      apiPost<Occurrence>(`/occurrences/${id}/payment`, {
        paidAmount,
        paymentDate,
        overpaymentChoice,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: occurrencesQueryKey(month) })
    },
  })
}

/**
 * "Descartar" — pula só esta ocorrência; a série continua no mês seguinte. Com
 * `wholeSeries`, também encerra a série neste mês (2026-10-01), o que muda os
 * meses seguintes, o DRE e a Home: por isso invalida tudo nesse caso.
 */
export function useDiscardOccurrence(month: Month) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, wholeSeries }: { id: string; wholeSeries: boolean }) =>
      apiPost<Occurrence>(
        `/occurrences/${id}/discard${wholeSeries ? '?closeRecurrence=true' : ''}`,
      ),
    onSuccess: (_result, { wholeSeries }) => {
      void (wholeSeries
        ? queryClient.invalidateQueries()
        : queryClient.invalidateQueries({ queryKey: occurrencesQueryKey(month) }))
    },
  })
}

/**
 * "Descartar" numa Parcela de Passivo — `POST /installments/{id}/discard`,
 * a terceira ação da linha de Passivo no Figma `10:2` (nó 144:17). Pula a
 * parcela deste mês; a série segue igual no mês seguinte (Figma `34:2` nó
 * 34:36), então só o cronograma daquele Passivo precisa ser reconsultado.
 */
export function useDiscardInstallment(liabilityId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    // `encodeURIComponent` NÃO é cerimônia: o id de uma Parcela é a chave
    // natural `${liabilityId}#${number}` (src/domain/assets/installments.ts),
    // e um `#` cru vira FRAGMENTO na URL. Medido:
    // `new URL('/api/v1/installments/<uuid>#13/discard', origin).pathname`
    // devolve `/api/v1/installments/<uuid>` — o servidor nunca vê "#13/discard"
    // e responde a página 404. Com o id codificado (`%2313`) a mesma chamada
    // responde 200 com `discarded: true` (medido em http://localhost:3099).
    mutationFn: (id: string) => apiPost<unknown>(`/installments/${encodeURIComponent(id)}/discard`),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['liabilities', liabilityId, 'installments'],
      })
    },
  })
}

// "Marcar Pago" numa Parcela de Passivo is `MarkInstallmentPaidDialog`
// (`@/components/patterns`) — shared with Detalhe do Passivo, self-contained,
// so this file only owns the occurrence-specific mutations above plus the
// Parcela's "Descartar".
