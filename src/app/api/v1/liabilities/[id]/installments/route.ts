/**
 * `GET /api/v1/liabilities/{id}/installments` — the amortisation schedule.
 *
 * Read-only: a Parcela is never posted by a client, only generated on
 * creation and recomputed on a reajuste (files_design/03 "calculado por
 * amortização, não digitado pela pessoa").
 */

import { asId, type LiabilityId } from '@/domain/core'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { NotFoundError, list } from '@/api/http'
import { idParams } from '@/api/contracts/common'

export const GET = handler({
  operation: 'liabilities.list_installments',
  params: idParams,
  handle: async ({ session, params }) => {
    const { liabilityReader, installmentReader } = getRepositories()
    const liabilityId = asId<LiabilityId>(params.id)
    const liability = await liabilityReader.findById(session.userId, liabilityId)
    if (liability === null) {
      throw new NotFoundError('O passivo solicitado não existe.')
    }
    const installments = await installmentReader.listByLiability(session.userId, liabilityId)
    return list(installments)
  },
})
