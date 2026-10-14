/**
 * `POST /api/v1/installments/{id}/payment` — "Marcar Paga" on a Parcela
 * (files_design/01 §12, files_design/03 "objeto Parcela").
 *
 * Unlike a Lançamento's "Marcar Pago", a divergent Parcela never becomes a
 * Pendência and never offers the three-way overpayment choice —
 * `markInstallmentPaid`'s own header comment names the source gap this route
 * deliberately does not paper over.
 */

import { asId, cents, isoDate, type InstallmentId } from '@/domain/core'
import { markInstallmentPaid } from '@/domain/assets'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { NotFoundError, ok } from '@/api/http'
import { installmentPaymentSchema } from '@/api/contracts/liabilities'
import { idParams } from '@/api/contracts/common'

export const POST = handler({
  operation: 'installments.pay',
  params: idParams,
  body: installmentPaymentSchema,
  handle: async ({ session, params, body }) => {
    const { installmentReader, installmentWriter, traceEventWriter } = getRepositories()
    const installmentId = asId<InstallmentId>(params.id)
    const installment = await installmentReader.findById(session.userId, installmentId)
    if (installment === null) {
      throw new NotFoundError('A parcela solicitada não existe.')
    }

    const result = markInstallmentPaid(
      installment,
      cents(body.paidAmount),
      isoDate(body.paymentDate),
    )

    const stored = await installmentWriter.replace(session.userId, result.installment)
    await traceEventWriter.append(session.userId, result.event)
    return ok(stored)
  },
})
