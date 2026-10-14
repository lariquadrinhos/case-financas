/**
 * `GET /api/v1/recurrences/{id}` — one série.
 *
 * No `PATCH`/`DELETE` here: editing a série's value happens through
 * `/api/v1/occurrences/{id}` ("Editar" with `scope: WholeSeries"), and ending
 * one happens through `./closure/route.ts` ("Encerrar recorrência" —
 * deliberately its own action, distinct from discarding a single month).
 */

import { asId, type RecurrenceId } from '@/domain/core'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { NotFoundError, ok } from '@/api/http'
import { idParams } from '@/api/contracts/common'

export const GET = handler({
  operation: 'recurrences.read',
  params: idParams,
  handle: async ({ session, params }) => {
    const { recurrenceReader } = getRepositories()
    const recurrence = await recurrenceReader.findById(
      session.userId,
      asId<RecurrenceId>(params.id),
    )
    if (recurrence === null) {
      throw new NotFoundError('A recorrência solicitada não existe.')
    }
    return ok(recurrence)
  },
})
