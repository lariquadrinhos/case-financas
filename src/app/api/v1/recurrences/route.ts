/**
 * `GET, POST /api/v1/recurrences` — Recorrência, the série a lançamento can
 * start (PRD §5 "Motor de recorrência").
 */

import { isoDate } from '@/domain/core'
import type { NewRecurrence } from '@/data/contracts/recurrences'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { created, list, resourcePath } from '@/api/http'
import { newRecurrenceSchema, recurrenceListQuerySchema } from '@/api/contracts/recurrences'

export const GET = handler({
  operation: 'recurrences.list',
  query: recurrenceListQuerySchema,
  handle: async ({ session, query }) => {
    const { recurrenceReader } = getRepositories()
    const items =
      query.includeClosed === 'true'
        ? await recurrenceReader.list(session.userId)
        : await recurrenceReader.listOpen(session.userId)
    return list(items)
  },
})

export const POST = handler({
  operation: 'recurrences.create',
  body: newRecurrenceSchema,
  handle: async ({ session, body }) => {
    const { recurrenceWriter } = getRepositories()
    const newRecurrence: NewRecurrence = {
      // The discriminated union round-trips through the Zod schema with plain
      // `string` fields for date/amount ids; the domain re-validates them at
      // this edge, the one place a `NewRecurrence` is assembled by hand.
      template: body.template as NewRecurrence['template'],
      amountKind: body.amountKind,
      startDate: isoDate(body.startDate),
      endsOn: body.endsOn === null ? null : isoDate(body.endsOn),
    }
    const stored = await recurrenceWriter.create(session.userId, newRecurrence)
    return created(resourcePath('recurrences', stored.id), stored)
  },
})
