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
import {
  PercentInput,
  formatPercentText,
  parsePercentText,
} from '@/features/plano-de-contas-e-patrimonio/percent-input'
import { currentIsoDate } from '@/lib/format'
import { apiPost } from '@/lib/api-client'
import { formatMonthlyRate } from '@/domain/assets'

/**
 * "Registrar Reajuste de Juros" — files_design/01 §12, Figma `94:2`. Shared by
 * Detalhe do Passivo (cabeçalho) and Revisão de Recorrentes ("Editar juros" na
 * linha de uma parcela) — the exact same flow either entry point opens
 * (files_design/01 §6: "abre o fluxo de Registrar Reajuste de Juros").
 *
 * The live count of affected instalments ("As N parcelas previstas a partir
 * dessa data serão recalculadas...") is computed from the SAME instalments the
 * caller already has loaded — this dialog does not fetch its own copy.
 */
export function RateAdjustmentDialog({
  open,
  onOpenChange,
  liabilityId,
  liabilityName,
  currentRate,
  plannedCountFrom,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  liabilityId: string
  liabilityName: string
  currentRate: number
  /** Given an ISO date, how many Previstas fall on/after it — Detalhe do Passivo and
   *  Revisão de Recorrentes each already hold the instalments list this counts over. */
  plannedCountFrom: (effectiveFrom: string) => number
  onSuccess: () => void
}) {
  const [rateText, setRateText] = React.useState('')
  const [effectiveFrom, setEffectiveFrom] = React.useState(() => currentIsoDate())
  const [error, setError] = React.useState<string | undefined>(undefined)
  const queryClient = useQueryClient()

  React.useEffect(() => {
    if (open) {
      setRateText('')
      setEffectiveFrom(currentIsoDate())
      setError(undefined)
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: (body: { newRate: number; effectiveFrom: string }) =>
      apiPost(`/liabilities/${liabilityId}/rate-adjustments`, body),
    onSuccess: () => {
      onSuccess()
      void queryClient.invalidateQueries({ queryKey: ['liabilities', liabilityId] })
      void queryClient.invalidateQueries({ queryKey: ['liabilities', liabilityId, 'installments'] })
      onOpenChange(false)
    },
  })

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const newRate = parsePercentText(rateText)
    if (newRate === null) {
      setError('Informe a nova taxa de juros.')
      return
    }
    setError(undefined)
    mutation.mutate({ newRate, effectiveFrom })
  }

  const affectedCount = effectiveFrom ? plannedCountFrom(effectiveFrom) : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 460 de largura: frame 94:39 (Wireframe) e nó "Diálogo" 994:2372 (Mockup). */}
      <DialogContent width="form">
        <DialogHeader>
          <DialogTitle>Registrar Reajuste de Juros</DialogTitle>
          <DialogDescription>
            Isso recalcula todas as parcelas futuras dessa dívida ({liabilityName}). Confira a taxa
            e a data com atenção antes de confirmar; parcelas já pagas não mudam.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <div className="flex items-center justify-between rounded-control border border-line-default px-16 py-12">
              <span className="text-style-body-sm text-ink-secondary">Taxa atual</span>
              <span className="numeric text-style-body-md text-ink-primary">
                {formatMonthlyRate(currentRate)}
              </span>
            </div>
            <Field label="Nova taxa de juros (a.m.)">
              {(fieldProps) => (
                <PercentInput
                  {...fieldProps}
                  value={rateText}
                  onValueChange={setRateText}
                  placeholder={`Ex: ${formatPercentText(currentRate + 0.001)}`}
                />
              )}
            </Field>
            <Field label="Válida a partir de">
              {(fieldProps) => (
                <DateField
                  {...fieldProps}
                  value={effectiveFrom}
                  onChange={(event) => setEffectiveFrom(event.target.value)}
                />
              )}
            </Field>
            {effectiveFrom ? (
              <p className="rounded-control bg-surface-alert px-16 py-12 text-style-body-sm text-ink-primary">
                As {affectedCount} parcelas previstas a partir dessa data serão recalculadas com a
                nova taxa. Parcelas já pagas não são alteradas.
              </p>
            ) : null}
            {(error ?? mutation.isError) ? (
              <p role="alert" className="text-style-body-sm text-ink-negative">
                {error ?? 'Não foi possível registrar o reajuste. Tente novamente.'}
              </p>
            ) : null}
            <RequiredFieldLegend />
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={mutation.isPending}>
              Confirmar Reajuste
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
