'use client'

import * as React from 'react'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
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
import {
  OVERPAYMENT_CHOICES,
  LABEL_OVERPAYMENT_CHOICE,
  type OverpaymentChoice,
} from '@/domain/entries'
import { ZERO, formatMoney, subtract, type Cents } from '@/domain/core'
import { currentIsoDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import { ApiError } from '@/lib/api-client'
import { useMarkOccurrencePaid } from '../_lib/mutations'
import { classifyPayment } from '../_lib/view-model'
import type { Month } from '@/domain/core'

const OVERPAYMENT_HELP: Record<OverpaymentChoice, string> = {
  DeductFromNext: 'Reduz o valor previsto do mês seguinte',
  // O texto desenhado é "Investimento, Passivo ou Receita: mesmo fluxo de Venda
  // de Bem Material" (Wireframe `152:15`). Ele descreve uma operação que ainda
  // não existe, e a API recusa a escolha — ver o cabeçalho da rota
  // `/occurrences/{id}/payment`: o dinheiro extra já saiu da conta, então
  // creditar um destino com ele inflaria o Balanço. Enquanto isso não é
  // decidido, o texto diz o que acontece de verdade em vez de prometer.
  RedirectExtra: 'Ainda não disponível: o valor extra já saiu da conta',
  NoAction: 'Só registra no histórico de eventos, sem decisão pendente',
}

/**
 * "Marcar Pago" na Revisão de Recorrentes — files_design/03 "Marcar Pago",
 * Figma `34:2` (estados ①/④/⑤). Pré-preenche valor previsto e data de hoje,
 * ambos editáveis; a divergência muda o rodapé do diálogo conforme o sinal
 * (files_design/03: pago a menos vira Pendência, pago a mais nunca vira e
 * oferece a escolha de 3 caminhos).
 */
export function MarkOccurrencePaidDialog({
  open,
  onOpenChange,
  month,
  occurrenceId,
  title,
  plannedAmount,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  month: Month
  occurrenceId: string
  title: string
  plannedAmount: Cents | null
}) {
  const [paidAmount, setPaidAmount] = React.useState<Cents>(plannedAmount ?? ZERO)
  const [paymentDate, setPaymentDate] = React.useState(() => currentIsoDate())
  const [overpaymentChoice, setOverpaymentChoice] = React.useState<OverpaymentChoice>('NoAction')

  React.useEffect(() => {
    if (open) {
      setPaidAmount(plannedAmount ?? ZERO)
      setPaymentDate(currentIsoDate())
      setOverpaymentChoice('NoAction')
    }
  }, [open, plannedAmount])

  const mutation = useMarkOccurrencePaid(month)
  const classification = classifyPayment(plannedAmount, paidAmount)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    mutation.mutate(
      {
        id: occurrenceId,
        paidAmount,
        paymentDate,
        overpaymentChoice: classification === 'Overpaid' ? overpaymentChoice : undefined,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 460 de largura, o diálogo-formulário (ver `form` em components/ui/dialog.tsx).
          Desenhado na Mockup em 2026-09-11 sobre a Revisão de Recorrentes:
          `Desktop — Confirmar Pagamento da Ocorrência (claro)` (`1417:6344`,
          diálogo `1415:6602`) e `(escuro)` (`1417:6449`). Até então só existia
          o esquema `34:2` do Wireframe, em escala reduzida (colunas de 400 com
          360 internos) — esquema, não geometria. */}
      <DialogContent width="form">
        <DialogHeader>
          <DialogTitle>Confirmar pagamento</DialogTitle>
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

            {classification === 'Underpaid' && plannedAmount !== null ? (
              <div className="flex flex-col gap-4 rounded-control bg-surface-alert px-16 py-12">
                <p className="text-style-body-md font-medium text-ink-alert">
                  {formatMoney(subtract(plannedAmount, paidAmount))} abaixo do previsto
                </p>
                <p className="text-style-body-sm text-ink-primary">
                  Esse valor fica pendente e passa a ser rastreado no histórico de eventos.
                </p>
              </div>
            ) : null}

            {classification === 'Overpaid' && plannedAmount !== null ? (
              <div className="flex flex-col gap-12">
                <p className="text-style-body-md text-ink-primary">
                  {formatMoney(subtract(paidAmount, plannedAmount))} a mais que o previsto. O que
                  fazer com a diferença?
                </p>
                <RadioGroupPrimitive.Root
                  value={overpaymentChoice}
                  onValueChange={(value) => setOverpaymentChoice(value as OverpaymentChoice)}
                  className="flex flex-col gap-8"
                >
                  {OVERPAYMENT_CHOICES.map((choice) => (
                    <RadioGroupPrimitive.Item
                      key={choice}
                      value={choice}
                      className={cn(
                        'flex flex-col items-start gap-4 rounded-control border px-16 py-12 text-left',
                        'outline-none transition-colors',
                        'focus-visible:outline focus-visible:outline-[var(--focus-ring)] focus-visible:outline-line-focus',
                        overpaymentChoice === choice
                          ? 'border-line-focus bg-surface-state'
                          : 'border-line-default hover:bg-surface-hover',
                      )}
                    >
                      <span className="text-style-body-md font-medium text-ink-primary">
                        {LABEL_OVERPAYMENT_CHOICE[choice]}
                      </span>
                      <span className="text-style-body-sm text-ink-secondary">
                        {OVERPAYMENT_HELP[choice]}
                      </span>
                    </RadioGroupPrimitive.Item>
                  ))}
                </RadioGroupPrimitive.Root>
              </div>
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
 * O motivo que o servidor deu, quando deu um. Medido em 2026-10-09: com a
 * série numa conta vinculada ao Open Finance, o servidor responde 409
 * explicando que o banco é quem paga — e este diálogo mostrava só "Tente
 * novamente", que nunca funciona nesse caso.
 */
function paymentErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.problem?.detail) return error.problem.detail
  return 'Não foi possível confirmar o pagamento. Tente novamente.'
}
