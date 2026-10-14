/**
 * `GET /api/v1/occurrences?month=` — Revisão de Recorrentes (PRD §5, ADR-0004
 * "materialização de ocorrências").
 *
 * There is no `POST`: an occurrence is never created by a client, the engine
 * generates it (`src/data/contracts/recurrences.ts`). This route IS where that
 * generation happens for the requested month — it "materialises" one row per
 * open série that is alive in `month`, via `occurrenceWriter.create`, which is
 * an idempotent get-or-create keyed by (série, mês)
 * (`src/data/sqlite/recurrences.repository.ts`): a month already visited, with
 * an occurrence already Paga or already edited, comes back untouched.
 */

import { occurrencesOfMonth } from '@/domain/recurrence'
import { month } from '@/domain/core'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { list } from '@/api/http'
import { occurrenceListQuerySchema } from '@/api/contracts/recurrences'

export const GET = handler({
  operation: 'occurrences.list',
  query: occurrenceListQuerySchema,
  handle: async ({ session, query }) => {
    const { recurrenceReader, occurrenceReader, occurrenceWriter } = getRepositories()
    const targetMonth = month(query.month)

    const openRecurrences = await recurrenceReader.listOpen(session.userId)
    const expected = occurrencesOfMonth(openRecurrences, targetMonth)
    for (const occurrence of expected) {
      const { id: _id, ...newOccurrence } = occurrence
      await occurrenceWriter.create(session.userId, newOccurrence)
    }

    const stored = await occurrenceReader.listByMonth(session.userId, targetMonth)
    const items =
      query.includeDiscarded === 'true'
        ? stored
        : stored.filter((occurrence) => !occurrence.discarded)
    return list(items)
  },
})
