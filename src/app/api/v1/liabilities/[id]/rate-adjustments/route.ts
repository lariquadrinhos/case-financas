/**
 * `POST /api/v1/liabilities/{id}/rate-adjustments` — "Registrar Reajuste de
 * Juros" (files_design/01 §12, files_design/03).
 *
 * Recomputes every installment still Prevista from `effectiveFrom` onwards;
 * parcelas já pagas are never rewritten — `applyRateAdjustment` is the single
 * source of that rule, this route only persists what it returned.
 */

import { asId, isoDate, type LiabilityId } from '@/domain/core'
import { applyRateAdjustment } from '@/domain/assets'
import { todayIsoDate } from '@/lib/clock'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { NotFoundError, list } from '@/api/http'
import { rateAdjustmentSchema } from '@/api/contracts/liabilities'
import { idParams } from '@/api/contracts/common'

export const POST = handler({
  operation: 'liabilities.register_rate_adjustment',
  params: idParams,
  body: rateAdjustmentSchema,
  handle: async ({ session, params, body }) => {
    const {
      liabilityReader,
      liabilityWriter,
      installmentReader,
      installmentWriter,
      rateAdjustmentWriter,
      traceEventWriter,
    } = getRepositories()
    const liabilityId = asId<LiabilityId>(params.id)
    const liability = await liabilityReader.findById(session.userId, liabilityId)
    if (liability === null) {
      throw new NotFoundError('O passivo solicitado não existe.')
    }

    const installments = await installmentReader.listByLiability(session.userId, liabilityId)
    const result = applyRateAdjustment(
      liability,
      installments,
      { liabilityId, newRate: body.newRate, effectiveFrom: isoDate(body.effectiveFrom) },
      todayIsoDate(),
    )

    await liabilityWriter.replace(session.userId, result.liability)
    const stored = await installmentWriter.replaceSchedule(
      session.userId,
      liabilityId,
      result.installments,
    )
    await rateAdjustmentWriter.append(session.userId, {
      liabilityId,
      newRate: body.newRate,
      effectiveFrom: isoDate(body.effectiveFrom),
    })
    await traceEventWriter.append(session.userId, result.event)

    return list(stored)
  },
})
