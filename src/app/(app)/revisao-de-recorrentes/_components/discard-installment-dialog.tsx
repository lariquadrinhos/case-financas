'use client'

import { useDiscardInstallment } from '../_lib/mutations'
import { DiscardThisMonthDialog } from './discard-this-month-dialog'

/**
 * "Descartar" numa Parcela de Passivo — o terceiro botão da linha de Passivo
 * no Figma `10:2` (nó 144:17, 86×31, depois de 144:13 "Marcar Pago" e 144:15
 * "Editar juros"). Mesmo diálogo do nó 34:31, e por isso mesmo texto: a
 * parcela deste mês é pulada, o cronograma não se desloca e o saldo devedor
 * fica igual (nó 34:36; `discardInstallment` em `@/domain/assets`).
 */
export function DiscardInstallmentDialog({
  open,
  onOpenChange,
  liabilityId,
  installmentId,
  title,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  liabilityId: string
  installmentId: string
  title: string
}) {
  const mutation = useDiscardInstallment(liabilityId)

  return (
    <DiscardThisMonthDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      isPending={mutation.isPending}
      isError={mutation.isError}
      onConfirm={() => mutation.mutate(installmentId, { onSuccess: () => onOpenChange(false) })}
    />
  )
}
