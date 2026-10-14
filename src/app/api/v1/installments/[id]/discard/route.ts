/**
 * `POST /api/v1/installments/{id}/discard` — "Descartar" numa Parcela de
 * Passivo, o terceiro botão da linha de Passivo na Revisão de Recorrentes
 * (Figma `10:2`, nó 144:17, ao lado de 144:13 "Marcar Pago" e 144:15 "Editar
 * juros"; diálogo no frame `34:2` nó 34:31).
 *
 * Pula a parcela na revisão DESTE mês e nada mais: o cronograma não se desloca
 * e o saldo devedor não muda — a regra está escrita no próprio frame, nó 34:36
 * ("A série continua normalmente a partir do mês seguinte"). Ver
 * `discardInstallment` em `@/domain/assets`.
 */

import { asId, type InstallmentId } from '@/domain/core'
import { discardInstallment } from '@/domain/assets'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { NotFoundError, ok } from '@/api/http'
import { idParams } from '@/api/contracts/common'

export const POST = handler({
  operation: 'installments.discard',
  params: idParams,
  handle: async ({ session, params }) => {
    const { installmentReader, installmentWriter } = getRepositories()
    const installmentId = asId<InstallmentId>(params.id)

    const installment = await installmentReader.findById(session.userId, installmentId)
    if (installment === null) {
      throw new NotFoundError('A parcela solicitada não existe.')
    }

    const stored = await installmentWriter.replace(session.userId, discardInstallment(installment))
    return ok(stored)
  },
})
