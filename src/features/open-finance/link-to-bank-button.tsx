'use client'

/**
 * "Vincular ao banco" (dono, 2026-10-09: "associar um depósito manual ao open
 * finance para não ter duplicidade e ter rastreabilidade"). O casamento
 * automático só liga mesmo valor e até 5 dias; aqui a pessoa escolhe a
 * transação. O mesmo botão em "Lançamentos deste mês" do DRE, no Histórico e
 * no Editar Lançamento. NÃO ESTÁ NO FIGMA.
 */

import * as React from 'react'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cents, formatDate, formatMoney, isoDate } from '@/domain/core'
import type { ListEnvelope } from '@/api/http'
import { ApiError, apiGet, apiPost } from '@/lib/api-client'
import { cn } from '@/lib/cn'
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

interface BankLinkCandidate {
  readonly transactionId: string
  readonly date: string
  readonly amount: number
  readonly description: string
  readonly providerCategory: string | null
}

export function LinkToBankButton({
  entryId,
  entryName,
  onLinked,
}: {
  entryId: string
  entryName: string
  onLinked?: () => void
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button variant="secondary" size="compact" onClick={() => setOpen(true)}>
        Vincular ao banco
      </Button>
      {open ? (
        <LinkToBankDialog
          entryId={entryId}
          entryName={entryName}
          onOpenChange={setOpen}
          onLinked={onLinked}
        />
      ) : null}
    </>
  )
}

function LinkToBankDialog({
  entryId,
  entryName,
  onOpenChange,
  onLinked,
}: {
  entryId: string
  entryName: string
  onOpenChange: (open: boolean) => void
  onLinked?: () => void
}) {
  const client = useQueryClient()
  const path = `/entries/${encodeURIComponent(entryId)}/bank-link`
  const candidates = useQuery({
    queryKey: ['entries', entryId, 'bank-link'] as const,
    queryFn: () => apiGet<ListEnvelope<BankLinkCandidate>>(path),
    retry: false,
  })
  const [chosen, setChosen] = React.useState<string | null>(null)
  const link = useMutation({
    mutationFn: (transactionId: string) => apiPost<unknown>(path, { transactionId }),
    onSuccess: () => {
      void client.invalidateQueries()
      onOpenChange(false)
      onLinked?.()
    },
  })
  const list = candidates.data?.data ?? []

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent width="form">
        <DialogHeader>
          <DialogTitle>Vincular &quot;{entryName}&quot; ao banco</DialogTitle>
          <DialogDescription>
            Escolha a transação do banco que é este lançamento. Valor e data passam a ser os do
            banco, e o lançamento que ela tinha criado sai, para não contar duas vezes.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {candidates.isPending ? (
            <p className="text-style-body-sm text-ink-secondary">Carregando…</p>
          ) : list.length === 0 ? (
            <p className="text-style-body-sm text-ink-secondary">
              Nenhuma transação para vincular: ela precisa ser da mesma conta, no mesmo sentido, até
              15 dias de distância, e ter entrado como um lançamento próprio.
            </p>
          ) : (
            <RadioGroupPrimitive.Root
              value={chosen ?? ''}
              onValueChange={setChosen}
              aria-label="Transação do banco"
              className="flex flex-col gap-8"
            >
              {list.map((c) => (
                <RadioGroupPrimitive.Item
                  key={c.transactionId}
                  value={c.transactionId}
                  className={cn(
                    'flex w-full items-center justify-between gap-16 rounded-control border px-16 py-8 text-left',
                    'outline-none transition-colors',
                    'focus-visible:outline focus-visible:outline-[var(--focus-ring)] focus-visible:outline-line-focus',
                    chosen === c.transactionId
                      ? 'border-line-focus bg-surface-state'
                      : 'border-line-default hover:bg-surface-hover',
                  )}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-style-body-md text-ink-primary">
                      {c.description}
                    </span>
                    <span className="text-style-body-sm text-ink-secondary">
                      {formatDate(isoDate(c.date))}
                      {c.providerCategory ? ` · No banco: ${c.providerCategory}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-style-numeric-md text-ink-primary">
                    {formatMoney(cents(c.amount))}
                  </span>
                </RadioGroupPrimitive.Item>
              ))}
            </RadioGroupPrimitive.Root>
          )}
          {link.isError ? (
            <p role="alert" className="text-style-body-sm text-ink-negative">
              {link.error instanceof ApiError && link.error.problem?.detail
                ? link.error.problem.detail
                : 'Não foi possível vincular. Tente novamente.'}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={chosen === null || link.isPending}
            onClick={() => chosen !== null && link.mutate(chosen)}
          >
            Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
