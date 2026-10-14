'use client'

import type { Month } from '@/domain/core'
import { useDiscardOccurrence } from '../_lib/mutations'
import { DiscardThisMonthDialog } from './discard-this-month-dialog'

/**
 * "Descartar" numa ocorrência de recorrência — Figma `10:2` nó 10:39, diálogo
 * `34:2` estado ③. Disponível pra qualquer recorrência, fixa ou a definir
 * (nó 34:42, files_design/01 §6).
 */
export function DiscardOccurrenceDialog({
  open,
  onOpenChange,
  month,
  occurrenceId,
  title,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  month: Month
  occurrenceId: string
  title: string
}) {
  const mutation = useDiscardOccurrence(month)

  return (
    <DiscardThisMonthDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      isPending={mutation.isPending}
      isError={mutation.isError}
      offerWholeSeries
      onConfirm={(wholeSeries) =>
        mutation.mutate({ id: occurrenceId, wholeSeries }, { onSuccess: () => onOpenChange(false) })
      }
    />
  )
}
