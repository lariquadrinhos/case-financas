/**
 * `GET /api/v1/trace-events` — Evento de rastreabilidade (files_design/03).
 *
 * Read-only: the person never writes one, the system generates it. Three
 * ways to ask, matching how a screen reads events — the Home's "Eventos
 * Recentes" (no filter, `limit` caps it at 5) and each Passivo's own full log
 * (`liabilityId`).
 *
 * `recurrenceId` exists because the port offers it (data/contracts/trace-events.ts
 * `listByRecurrence`); what no source draws is a "Detalhe da Recorrência" to
 * consume it — there is no such frame in docs/figma/INDEX.md nor in the Mockup,
 * and PRD §1 puts a full-log screen out of scope. That is about the FILTER, not
 * about the origin: an event whose origin is a Recorrência very much has a
 * screen, and it is this endpoint's unfiltered read. Figma, page Wireframe,
 * `150:8` inside the card `150:2` (frame `5:2`) is the FIRST of the Home's five
 * lines — "Aluguel pago com divergência: previsto R$ 1.500,00, pago
 * R$ 1.300,00 (R$ 200,00 pendente)" — and Mockup `549:282` repeats it. So
 * `listRecent` must never filter origins; pinned by
 * `src/data/sqlite/trace-events.repository.test.ts`.
 */

import { asId, type LiabilityId, type RecurrenceId } from '@/domain/core'
import type { TraceEvent } from '@/domain/trace-events'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { list } from '@/api/http'
import { z } from '@/api/registry'
import { idSchema } from '@/api/contracts/common'

// Same (unregistered) shape `src/api/contracts/trace-events.ts` documents for
// this endpoint — kept anonymous here too, so there is one definition of it.
const query = z.strictObject({
  liabilityId: idSchema.optional(),
  recurrenceId: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export const GET = handler({
  operation: 'trace_events.list',
  query,
  handle: async ({ session, query: filter }) => {
    const { traceEventReader, liabilityReader } = getRepositories()

    /**
     * P35: o texto gravado é o do Detalhe do Passivo, que não repete o nome da
     * dívida porque ele já é o título daquela tela. A Home não tem esse
     * contexto e monta a frase dela com o nome ATUAL — então a resposta carrega
     * o nome, não uma segunda frase. Quem transforma é `describeEventForHome`.
     */
    async function withSubject(events: readonly TraceEvent[]) {
      if (!events.some((event) => event.origin.kind === 'Liability')) {
        return events.map((event) => ({ ...event, subject: null }))
      }
      const liabilities = await liabilityReader.list(session.userId)
      const nameOf = new Map(liabilities.map((liability) => [liability.id, liability.name]))
      return events.map((event) => ({
        ...event,
        subject:
          event.origin.kind === 'Liability' ? (nameOf.get(event.origin.liabilityId) ?? null) : null,
      }))
    }

    if (filter.liabilityId !== undefined) {
      const events = await traceEventReader.listByLiability(
        session.userId,
        asId<LiabilityId>(filter.liabilityId),
      )
      return list(await withSubject(events))
    }
    if (filter.recurrenceId !== undefined) {
      const events = await traceEventReader.listByRecurrence(
        session.userId,
        asId<RecurrenceId>(filter.recurrenceId),
      )
      return list(await withSubject(events))
    }

    const events = await traceEventReader.listRecent(session.userId, {
      limit: filter.limit,
      offset: 0,
    })
    return list(await withSubject(events))
  },
})
