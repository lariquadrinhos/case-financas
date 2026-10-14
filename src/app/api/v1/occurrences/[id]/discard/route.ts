/**
 * `POST /api/v1/occurrences/{id}/discard` — "Descartar": skips THIS month
 * only, available for Fixo and A definir alike. The série is untouched and
 * keeps producing next month's occurrence normally
 * (src/domain/recurrence/engine.ts `discardOccurrence`; files_design/04 —
 * different from "Encerrar", which stops the série for good).
 *
 * `?closeRecurrence=true` — "a série completa" (pedido do dono, 2026-10-01:
 * "o descartar para recorrência também deveria mostrar só esse mês ou a série
 * completa"): discards this month AND closes the série on its date, the same
 * pair "Descartar" + "Encerrar a recorrência também" does for a Lançamento
 * (`DELETE /entries/{id}?closeRecurrence=true`). The server picks the date
 * because the DRE row that asks for it does not carry one.
 */

import {
  closeRecurrence,
  discardOccurrence,
  occurrencesDiscardedByClosure,
} from '@/domain/recurrence'
import { asId, type OccurrenceId } from '@/domain/core'
import { getRepositories, withTransaction } from '@/data'
import { findOrMaterializeOccurrence } from '@/api/occurrence-lookup'
import { handler } from '@/api/handler'
import { NotFoundError, ok } from '@/api/http'
import { idParams } from '@/api/contracts/common'
import { occurrenceDiscardQuerySchema } from '@/api/contracts/recurrences'

export const POST = handler({
  operation: 'occurrences.discard',
  params: idParams,
  query: occurrenceDiscardQuerySchema,
  handle: async ({ session, params, query }) => {
    const { occurrenceReader } = getRepositories()
    const occurrenceId = asId<OccurrenceId>(params.id)

    const occurrence = await findOrMaterializeOccurrence(
      getRepositories(),
      session.userId,
      occurrenceId,
    )
    if (occurrence === null) {
      throw new NotFoundError('A ocorrência solicitada não existe.')
    }

    const discarded = discardOccurrence(occurrence)
    const stored = await withTransaction(
      async ({ occurrenceWriter, recurrenceReader, recurrenceWriter }) => {
        const saved = await occurrenceWriter.replace(session.userId, discarded)
        if (query.closeRecurrence === 'true') {
          const recurrence = await recurrenceReader.findById(
            session.userId,
            occurrence.recurrenceId,
          )
          if (recurrence === null) throw new NotFoundError('A série desta ocorrência não existe.')
          const closed = closeRecurrence(recurrence, occurrence.plannedDate)
          await recurrenceWriter.replace(session.userId, closed)
          const later = occurrencesDiscardedByClosure(
            await occurrenceReader.listByRecurrence(session.userId, recurrence.id),
            closed.closedOn!,
          )
          if (later.length > 0) await occurrenceWriter.replaceMany(session.userId, later)
        }
        return saved
      },
    )
    return ok(stored)
  },
})
