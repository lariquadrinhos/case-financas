'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, RequiredFieldLegend } from '@/components/ui/field'
import { DateField } from '@/components/patterns/date-field'
import { MoneyInput } from '@/components/patterns/money-input'
import { type Cents } from '@/domain/core'
import { currentIsoDate } from '@/lib/format'
import { apiPost, ApiError } from '@/lib/api-client'

/**
 * "Marcar Pago"/"Marcar Paga" numa Parcela de Passivo — `POST
 * /installments/{id}/payment` (files_design/03 "objeto Parcela"). Shared by
 * Revisão de Recorrentes ("Marcar Pago" na linha de uma parcela) and Detalhe
 * do Passivo ("Marcar Paga" na lista "Parcelas") — the same action, two entry
 * points (files_design/01 §6/§12).
 *
 * Unlike the equivalent for a recorrência occurrence, a divergent instalment
 * NEVER becomes a Pendência and never offers the three-way overpayment choice
 * (`src/domain/assets/installments.ts`: "no source extends UC26's three-choice
 * machinery... to Fluxo K") — the server always generates one Evento, and this
 * dialog has nothing else to ask.
 */
export function MarkInstallmentPaidDialog({
  open,
  onOpenChange,
  liabilityId,
  installmentId,
  title,
  plannedAmount,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  liabilityId: string
  installmentId: string
  title: string
  plannedAmount: Cents
  onSuccess?: () => void
}) {
  const [paidAmount, setPaidAmount] = React.useState<Cents>(plannedAmount)
  const [paymentDate, setPaymentDate] = React.useState(() => currentIsoDate())
  const queryClient = useQueryClient()

  React.useEffect(() => {
    if (open) {
      setPaidAmount(plannedAmount)
      setPaymentDate(currentIsoDate())
    }
  }, [open, plannedAmount])

  const mutation = useMutation({
    // `encodeURIComponent` NÃO é cerimônia: o id de uma Parcela é a chave
    // natural `${liabilityId}#${number}` (src/domain/assets/installments.ts:160),
    // e um `#` cru vira FRAGMENTO na URL. Medido:
    // `new URL('http://x/api/v1/installments/<uuid>#12/payment').pathname`
    // devolve `/api/v1/installments/<uuid>` — o "/payment" some, o servidor
    // nunca vê a ação, e "Marcar Pago" numa parcela ficava quebrado nas TRÊS
    // telas que usam este diálogo (DRE, Detalhe do Passivo, Revisão de
    // Recorrentes). O irmão `useDiscardInstallment`
    // (src/app/(app)/revisao-de-recorrentes/_lib/mutations.ts:86) já carregava
    // esse mesmo diagnóstico; este diálogo tinha ficado de fora.
    mutationFn: () =>
      apiPost(`/installments/${encodeURIComponent(installmentId)}/payment`, {
        paidAmount,
        paymentDate,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['liabilities', liabilityId, 'installments'] })
      void queryClient.invalidateQueries({ queryKey: ['liabilities', liabilityId] })
      void queryClient.invalidateQueries({ queryKey: ['trace-events', 'liability', liabilityId] })
      onSuccess?.()
      onOpenChange(false)
    },
  })

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 460 de largura, o diálogo-formulário (ver `form` em components/ui/dialog.tsx).
          Desenhado na Mockup em 2026-09-11 sobre o Detalhe do Passivo:
          `Desktop — Marcar Parcela Paga (claro)` (`1415:6046`, diálogo
          `1415:6196`) e `(escuro)` (`1415:6249`). Até então só existia o
          esquema `34:2` do Wireframe, em escala reduzida (colunas de 400 com
          360 internos) — esquema, não geometria. */}
      <DialogContent width="form">
        <DialogHeader>
          <DialogTitle>Marcar Paga</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <Field label="Valor pago">
              {(fieldProps) => (
                <MoneyInput {...fieldProps} value={paidAmount} onValueChange={setPaidAmount} />
              )}
            </Field>
            <Field label="Data de pagamento">
              {(fieldProps) => (
                <DateField
                  {...fieldProps}
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                />
              )}
            </Field>
            {mutation.isError ? (
              <p role="alert" className="text-style-body-sm text-ink-negative">
                {paymentErrorMessage(mutation.error)}
              </p>
            ) : null}
            {/* files_design/03: a legenda aparece uma vez por tela ou diálogo
              com campo obrigatório, no fim da área de campos. */}
            <RequiredFieldLegend />
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={mutation.isPending}>
              Confirmar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * O motivo que o servidor deu, quando deu um. Medido em 2026-10-09: com o
 * Previsto numa conta vinculada ao Open Finance, o servidor responde 409
 * explicando que o banco é quem paga — e este diálogo mostrava só "Tente
 * novamente", que nunca funciona nesse caso.
 */
function paymentErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.problem?.detail) return error.problem.detail
  return 'Não foi possível confirmar o pagamento. Tente novamente.'
}
