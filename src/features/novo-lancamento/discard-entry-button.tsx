'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ConfirmActionButton } from '@/components/patterns/confirm-action-button'
import { Switch } from '@/components/ui/switch'
import { apiDelete } from '@/lib/api-client'

/**
 * "Descartar lançamento" (pedido de produto, 2026-09-23) — no modo de edição do
 * Novo Lançamento e na linha do Histórico, com a MESMA confirmação dos itens de
 * cadastro (`ConfirmActionButton`, Figma `34:34`) e o mesmo verbo: o glossário
 * (files_design/04) fecha "Descartar", nunca "Excluir".
 *
 * Um lançamento de série pode também "Encerrar recorrência" no mesmo passo;
 * encerrar e descartar continuam ações distintas (files_design/04), por isso é
 * uma escolha explícita, desligada por padrão.
 */
export function DiscardEntryButton({
  entryId,
  entryName,
  hasRecurrence,
  onDiscarded,
  className,
  size,
}: {
  entryId: string
  entryName: string
  hasRecurrence: boolean
  onDiscarded?: () => void
  className?: string
  size?: 'compact' | 'default'
}) {
  const client = useQueryClient()
  const [closeRecurrence, setCloseRecurrence] = React.useState(false)
  const switchId = React.useId()
  const discard = useMutation({
    mutationFn: () =>
      apiDelete(`/entries/${entryId}${closeRecurrence ? '?closeRecurrence=true' : ''}`),
    // O descarte mexe em lançamento, ocorrência, série e em todo relatório que
    // os lê — invalidar tudo é o que não deixa nenhuma tela com o valor velho.
    onSuccess: () => client.invalidateQueries(),
  })

  return (
    <ConfirmActionButton
      label="Descartar"
      itemName={entryName}
      className={className}
      size={size}
      consequence={
        hasRecurrence
          ? 'O lançamento sai do Histórico e dos relatórios. Se ele é o pagamento de um mês da recorrência, esse mês fica descartado.'
          : 'O lançamento sai do Histórico e dos relatórios.'
      }
      blockedMessage="Este lançamento foi pago com divergência e tem um Evento ou uma Pendência ligados a ele, por isso não pode ser descartado."
      pending={discard.isPending}
      onConfirm={async () => {
        await discard.mutateAsync()
        onDiscarded?.()
      }}
    >
      {hasRecurrence ? (
        <div className="flex items-center justify-between gap-16">
          <label htmlFor={switchId} className="text-style-body-md text-ink-primary">
            Encerrar a recorrência também
          </label>
          <Switch id={switchId} checked={closeRecurrence} onCheckedChange={setCloseRecurrence} />
        </div>
      ) : undefined}
    </ConfirmActionButton>
  )
}
