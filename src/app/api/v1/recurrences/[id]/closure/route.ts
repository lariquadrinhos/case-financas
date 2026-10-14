/**
 * `POST /api/v1/recurrences/{id}/closure` — "Encerrar recorrência".
 *
 * Different from "Descartar" (`/api/v1/occurrences/{id}/discard`), which skips
 * a single month: this stops the série for good, from `closedOn` onward
 * (src/domain/recurrence/engine.ts `closeRecurrence`).
 */

import { closeRecurrence, occurrencesDiscardedByClosure } from '@/domain/recurrence'
import { asId, isoDate, type RecurrenceId } from '@/domain/core'
import { getRepositories, withTransaction } from '@/data'
import { handler } from '@/api/handler'
import { NotFoundError, ok } from '@/api/http'
import { closeRecurrenceSchema } from '@/api/contracts/recurrences'
import { idParams } from '@/api/contracts/common'

export const POST = handler({
  operation: 'recurrences.close',
  params: idParams,
  body: closeRecurrenceSchema,
  handle: async ({ session, params, body }) => {
    const { recurrenceReader } = getRepositories()
    const recurrenceId = asId<RecurrenceId>(params.id)
    const existing = await recurrenceReader.findById(session.userId, recurrenceId)
    if (existing === null) {
      throw new NotFoundError('A recorrência solicitada não existe.')
    }

    const closed = closeRecurrence(existing, isoDate(body.closedOn))
    const stored = await withTransaction(
      async ({ recurrenceWriter, occurrenceReader, occurrenceWriter }) => {
        const replaced = await recurrenceWriter.replace(session.userId, closed)
        const materialized = await occurrenceReader.listByRecurrence(session.userId, recurrenceId)
        const discarded = occurrencesDiscardedByClosure(materialized, closed.closedOn!)
        if (discarded.length > 0) await occurrenceWriter.replaceMany(session.userId, discarded)
        return replaced
      },
    )
    return ok(stored)
  },
})
