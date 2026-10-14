/**
 * `PATCH /api/v1/occurrences/{id}` — "Editar" on the Revisão de Recorrentes
 * (PRD UC14; src/domain/recurrence/engine.ts `editOccurrence`).
 *
 * `scope: 'ThisOnly'` touches only this occurrence; `scope: 'WholeSeries'`
 * rewrites the série's template AND every occurrence still "em aberto"
 * (Previsto, not descartada) — status-based, not time-based, so a late one is
 * reached too (files_design/02).
 */

import { editOccurrence, isOpen, type RecurrenceTemplate } from '@/domain/recurrence'
import { assertCategoryFitsKind } from '@/api/entry-category'
import { asId, cents, type OccurrenceId } from '@/domain/core'
import { getRepositories } from '@/data'
import { findOrMaterializeOccurrence } from '@/api/occurrence-lookup'
import { handler } from '@/api/handler'
import { NotFoundError, list, ok } from '@/api/http'
import { occurrencePatchSchema } from '@/api/contracts/recurrences'
import { idParams } from '@/api/contracts/common'

/** Uma ocorrência — o formulário "Editar" da série a lê para se preencher (2026-10-01). */
export const GET = handler({
  operation: 'occurrences.read',
  params: idParams,
  handle: async ({ session, params }) => {
    const occurrence = await findOrMaterializeOccurrence(
      getRepositories(),
      session.userId,
      asId<OccurrenceId>(params.id),
    )
    if (occurrence === null) {
      throw new NotFoundError('A ocorrência solicitada não existe.')
    }
    return ok(occurrence)
  },
})

export const PATCH = handler({
  operation: 'occurrences.update',
  params: idParams,
  body: occurrencePatchSchema,
  handle: async ({ session, params, body }) => {
    const { recurrenceReader, recurrenceWriter, occurrenceReader, occurrenceWriter } =
      getRepositories()
    const occurrenceId = asId<OccurrenceId>(params.id)

    const target = await findOrMaterializeOccurrence(
      getRepositories(),
      session.userId,
      occurrenceId,
    )
    if (target === null) {
      throw new NotFoundError('A ocorrência solicitada não existe.')
    }
    const recurrence = await recurrenceReader.findById(session.userId, target.recurrenceId)
    if (recurrence === null) {
      throw new NotFoundError('A série desta ocorrência não existe.')
    }
    const occurrences = await occurrenceReader.listByRecurrence(session.userId, recurrence.id)

    const template = body.template as RecurrenceTemplate | undefined
    if (template !== undefined) {
      await assertCategoryFitsKind(getRepositories(), session.userId, template)
    }
    const result = editOccurrence({
      recurrence,
      occurrences,
      occurrenceId,
      change: {
        plannedAmount: cents(body.plannedAmount),
        ...(body.description !== undefined ? { description: body.description || null } : {}),
        ...(template !== undefined ? { template } : {}),
      },
      scope: body.scope,
    })

    const affected =
      body.scope === 'ThisOnly'
        ? result.occurrences.filter((occurrence) => occurrence.id === occurrenceId)
        : result.occurrences.filter(isOpen)

    if (body.scope === 'WholeSeries') {
      await recurrenceWriter.replace(session.userId, result.recurrence)
    }
    const stored = await occurrenceWriter.replaceMany(session.userId, affected)
    return list(stored)
  },
})
