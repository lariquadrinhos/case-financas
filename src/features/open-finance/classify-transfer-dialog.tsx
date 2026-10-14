'use client'

/**
 * "Classificar agora" — o que foi uma transferência entre a PJ e a PF
 * (2026-09-29). Cada opção diz o que acontece no DRE, porque é isso que a
 * pessoa está decidindo. NÃO ESTÁ NO FIGMA: usa o Dialog do design system.
 */

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cents, formatMoney } from '@/domain/core'
import { transferClassificationsFor, type TransferClassification } from '@/domain/open-finance'
import { apiPost, ApiError } from '@/lib/api-client'

export interface TransferToClassify {
  readonly transactionId: string
  readonly from: 'PF' | 'PJ'
  readonly to: 'PF' | 'PJ'
  readonly amount: number
  readonly description: string
}

const OPTION: Record<TransferClassification, { label: string; effect: string }> = {
  ProLabore: {
    label: 'Pró-labore',
    effect: 'Despesa da PJ e receita da PF. Some no Consolidado.',
  },
  ProfitDistribution: {
    label: 'Distribuição de lucro',
    effect: 'Sai do lucro da PJ (Destinação) e é receita da PF. Some no Consolidado.',
  },
  CapitalContribution: {
    label: 'Aporte na PJ',
    effect: 'Dinheiro seu colocado na empresa. Fica fora do DRE.',
  },
  Transfer: {
    label: 'Só transferência',
    effect: 'Um reembolso ou um acerto. Fica fora do DRE.',
  },
}

export function ClassifyTransferDialog({
  transfer,
  onOpenChange,
}: {
  transfer: TransferToClassify | null
  onOpenChange: (open: boolean) => void
}) {
  const client = useQueryClient()
  const classify = useMutation({
    mutationFn: (classification: TransferClassification) =>
      apiPost(
        `/open-finance/transfers/${encodeURIComponent(transfer!.transactionId)}/classification`,
        { classification },
      ),
    onSuccess: () => {
      void client.invalidateQueries()
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={transfer !== null} onOpenChange={onOpenChange}>
      <DialogContent width="form">
        <DialogHeader>
          <DialogTitle>O que foi esta transferência?</DialogTitle>
          {transfer !== null ? (
            <DialogDescription>
              {formatMoney(cents(transfer.amount))} de {transfer.from} para {transfer.to}:{' '}
              {transfer.description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-8">
            {transfer !== null
              ? transferClassificationsFor(transfer.from, transfer.to).map((option) => (
                  <Button
                    key={option}
                    variant="secondary"
                    width="full"
                    disabled={classify.isPending}
                    onClick={() => classify.mutate(option)}
                    className="h-auto flex-col items-start gap-4 py-12 text-left"
                  >
                    <span className="text-style-body-md text-ink-primary">
                      {OPTION[option].label}
                    </span>
                    <span className="text-style-body-sm text-ink-secondary">
                      {OPTION[option].effect}
                    </span>
                  </Button>
                ))
              : null}
            {classify.isError ? (
              <p role="alert" className="text-style-body-sm text-ink-negative">
                {classify.error instanceof ApiError
                  ? classify.error.message
                  : 'Não foi possível classificar.'}
              </p>
            ) : null}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
