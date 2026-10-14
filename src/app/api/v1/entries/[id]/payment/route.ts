/**
 * `POST /api/v1/entries/{id}/payment` — "Marcar Pago" on a standalone
 * Lançamento (files_design/03 "Marcar Pago"; the same action for a recurrence
 * occurrence lives at `/api/v1/occurrences/{id}/payment`, which creates the
 * entry instead of editing one).
 *
 * Wires the two side effects the Pendências e Rastreabilidade context owns
 * (docs/event-storming §"Bounded contexts", contexto 7): every divergence
 * gets a `TraceEvent`, and only an `Underpaid` one also becomes a
 * `PaymentDiscrepancy` — the asymmetry `@/domain/pending-items` enforces.
 * Origin is `{ kind: 'Entry' }` because a standalone Lançamento has neither a
 * Passivo nor uma Recorrência behind it.
 *
 * The write itself, plus the TraceEvent and the PaymentDiscrepancy, run inside
 * `withTransaction` (ADR-0014): three ports, one unit of work. files_design/03
 * says pagar a menos SEMPRE vira Pendência — three separately-committed writes
 * made that conditional on nothing failing in between, which a measured probe
 * showed was false (docs/adr/0014 §2).
 */

import { randomUUID } from 'node:crypto'

import { markAsPaid } from '@/domain/entries'
import { buildTraceEvent } from '@/domain/trace-events'
import { pendingItemFromPaymentOutcome } from '@/domain/pending-items'
import { asId, cents, isoDate, type EntryId, type TraceEventId } from '@/domain/core'
import { entrySubject } from '@/api/entry-subject'
import { getRepositories, withTransaction } from '@/data'
import { handler } from '@/api/handler'
import { NotFoundError, ok } from '@/api/http'
import { markAsPaidSchema } from '@/api/contracts/entries'
import { idParams } from '@/api/contracts/common'

export const POST = handler({
  operation: 'entries.mark_as_paid',
  params: idParams,
  body: markAsPaidSchema,
  handle: async ({ session, params, body }) => {
    const { entryReader, categoryReader } = getRepositories()
    const entryId = asId<EntryId>(params.id)
    const existing = await entryReader.findById(session.userId, entryId)
    if (existing === null) {
      throw new NotFoundError('O lançamento solicitado não existe.')
    }

    const paidAmount = cents(body.paidAmount)
    const paymentDate = isoDate(body.paymentDate)
    const { entry, outcome } = markAsPaid(existing, paidAmount, paymentDate)

    const stored = await withTransaction(
      async ({ entryWriter, traceEventWriter, paymentDiscrepancyWriter }) => {
        const replaced = await entryWriter.replace(session.userId, entry)

        // Exact never generates anything (files_design/03) — only a divergence does.
        if (outcome.kind !== 'Exact') {
          const origin = { kind: 'Entry' as const, entryId: replaced.id }
          const subject = await entrySubject(replaced, categoryReader, session.userId)
          const traceEvent = buildTraceEvent('Discrepancy', origin, {
            id: asId<TraceEventId>(randomUUID()),
            date: paymentDate,
            subject,
            plannedAmount: existing.amount,
            paidAmount,
          })
          await traceEventWriter.append(session.userId, traceEvent)

          // "pago a menos SEMPRE vira Pendência; pago a mais NUNCA vira" — the
          // asymmetry lives in `pendingItemFromPaymentOutcome`, not here.
          const newDiscrepancy = pendingItemFromPaymentOutcome(outcome, origin, paymentDate)
          if (newDiscrepancy !== null) {
            await paymentDiscrepancyWriter.create(session.userId, newDiscrepancy)
          }
        }

        return replaced
      },
    )

    return ok({ entry: stored, outcome })
  },
})
