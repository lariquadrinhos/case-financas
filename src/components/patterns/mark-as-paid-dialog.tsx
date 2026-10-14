'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { type Cents, type EntryId, cents, formatMoney, isoDate } from '@/domain/core'
import { currentIsoDate } from '@/lib/format'
import { apiPost, ApiError } from '@/lib/api-client'
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
import { Input } from '@/components/ui/input'
import { MoneyInput } from '@/components/patterns/money-input'

interface MarkAsPaidOutcome {
  readonly kind: 'Exact' | 'Underpaid' | 'Overpaid'
  readonly shortfall?: number
  readonly excess?: number
}

/**
 * "Marcar Pago" on a single Lançamento — files_design/03 "Marcar Pago",
 * files_design/01 §8.1 (the DRE's "Lançamentos deste mês" row action). Pre-fills
 * the planned amount and today's date, both editable, and posts the real
 * `/entries/{id}/payment` action (`src/app/api/v1/entries/[id]/payment`) — the
 * same endpoint Revisão de Recorrentes will use for a standalone Lançamento.
 *
 * `overpaymentChoice` is deliberately never sent: the route handler
 * (`src/app/api/v1/entries/[id]/payment/route.ts`) never reads that field —
 * only `@/domain/pending-items`'s asymmetry (a shortfall becomes a Pendência,
 * an excess never does) decides the outcome — so there is nothing this dialog
 * would do with a three-way choice the server does not consult.
 */
export function MarkAsPaidDialog({
  open,
  onOpenChange,
  entryId,
  entryName,
  plannedAmount,
  onPaid,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entryId: EntryId
  entryName: string
  plannedAmount: Cents
  onPaid: () => void
}) {
  const [paidAmount, setPaidAmount] = React.useState<Cents>(plannedAmount)
  const [paymentDate, setPaymentDate] = React.useState(() => currentIsoDate())

  // Re-seed the fields to THIS row's numbers every time the dialog opens for a
  // (possibly different) row — otherwise the second row opened in a session
  // would still show the first row's pre-fill.
  React.useEffect(() => {
    if (open) {
      setPaidAmount(plannedAmount)
      setPaymentDate(currentIsoDate())
    }
  }, [open, plannedAmount])

  const mutation = useMutation({
    mutationFn: () =>
      apiPost<{ outcome: MarkAsPaidOutcome }>(`/entries/${entryId}/payment`, {
        paidAmount,
        paymentDate: isoDate(paymentDate),
      }),
    onSuccess: (data) => {
      onPaid()
      // A divergent outcome stays open long enough for the person to read the
      // warning (files_design/01 §6) — an exact payment closes right away,
      // same as every other confirm-and-done action in the product.
      if (data.outcome.kind === 'Exact') onOpenChange(false)
    },
  })

  const outcome = mutation.data?.outcome
  const divergent = outcome !== undefined && outcome.kind !== 'Exact'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 460 de largura, o diálogo-formulário (ver `form` em components/ui/dialog.tsx).
          Desenhado na Mockup em 2026-09-11 sobre o DRE, que é de onde este
          diálogo abre: `Desktop — Marcar Pago (claro)` (`1417:5932`, diálogo
          `1415:5790`) e `(escuro)` (`1417:6138`). Até então só existia o
          esquema `34:2` do Wireframe, em escala reduzida (colunas de 400 com
          360 internos) — esquema, não geometria. */}
      <DialogContent width="form">
        <DialogHeader>
          <DialogTitle>Confirmar</DialogTitle>
          <DialogDescription>{entryName}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Field label="Valor pago">
            {(fieldProps) => (
              <MoneyInput value={paidAmount} onValueChange={setPaidAmount} {...fieldProps} />
            )}
          </Field>
          <Field label="Data do pagamento">
            {(fieldProps) => (
              <Input
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                {...fieldProps}
              />
            )}
          </Field>
          {/* files_design/01 §6: "Se o valor pago divergir do previsto, mostra
              aviso explícito" — same rule this dialog borrows for the DRE row. */}
          {divergent && outcome ? (
            <p role="alert" className="text-style-body-sm text-ink-alert">
              {outcome.kind === 'Underpaid'
                ? `Pago ${formatMoney(cents(outcome.shortfall ?? 0))} a menos que o previsto. Isso vira uma pendência.`
                : `Pago ${formatMoney(cents(outcome.excess ?? 0))} a mais que o previsto.`}
            </p>
          ) : null}
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
          {divergent ? (
            <Button variant="primary" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
              >
                Confirmar
              </Button>
            </>
          )}
        </DialogFooter>
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
