/**
 * `POST /api/v1/occurrences/{id}/payment` — "Marcar Pago" on a recurrence
 * occurrence (files_design/03 "Marcar Pago" applied to Revisão de
 * Recorrentes; src/domain/recurrence/payment.ts).
 *
 * Unlike `/api/v1/entries/{id}/payment`, this CREATES the Lançamento: a
 * Previsto occurrence has none yet (PRD §1 — Previsto never enters the DRE).
 *
 * Wires the two side effects the Pendências e Rastreabilidade context owns
 * (Event Storming, Fluxo J): a `RecurrencePaid` Evento when the payment
 * matched the plan, a `Discrepancy` Evento when it did not — both origin
 * `{ kind: 'Recurrence' }`, so `Detalhe do Passivo`-style per-series logs
 * still work — and, only on `Underpaid`, a `PaymentDiscrepancy` (H13). A
 * "a definir" occurrence paid for the FIRST time has no baseline
 * (`payOccurrence`'s `outcome` is `null`): neither an Evento nor a Pendência
 * is generated, because there is nothing to diverge from.
 *
 * `overpaymentChoice` in the body is accepted by the schema but not yet acted
 * on: descontar da próxima ocorrência / redirecionar o valor extra need the
 * generic "Redirecionamento" concept the PRD still calls a single, unbuilt
 * concept (H12) — recording the choice without a place to spend it would be a
 * silent no-op with no source describing what it should have done instead.
 *
 * The Lançamento create, the Occurrence replace, the TraceEvent and the
 * PaymentDiscrepancy — four ports — run inside `withTransaction` (ADR-0014),
 * for the same reason as `/entries/{id}/payment`: files_design/03's "sempre"
 * has to survive a write failing partway through, not just the happy path.
 */

import { randomUUID } from 'node:crypto'

import {
  deductFromNextOccurrence,
  occurrenceIdFor,
  occurrenceOfMonth,
  occurrencePaidWith,
  payOccurrence,
} from '@/domain/recurrence'
import { buildTraceEvent } from '@/domain/trace-events'
import { pendingItemFromPaymentOutcome } from '@/domain/pending-items'
import {
  asId,
  cents,
  isoDate,
  type OccurrenceId,
  type TraceEventId,
  nextMonth,
} from '@/domain/core'
import { entrySubject } from '@/api/entry-subject'
import { getRepositories, withTransaction } from '@/data'
import { findOrMaterializeOccurrence } from '@/api/occurrence-lookup'
import { handler } from '@/api/handler'
import { NotFoundError, ok } from '@/api/http'
import { markAsPaidSchema } from '@/api/contracts/entries'
import { idParams } from '@/api/contracts/common'

export const POST = handler({
  operation: 'occurrences.mark_as_paid',
  params: idParams,
  body: markAsPaidSchema,
  handle: async ({ session, params, body }) => {
    const { recurrenceReader, occurrenceReader, categoryReader } = getRepositories()
    const occurrenceId = asId<OccurrenceId>(params.id)

    const occurrence = await findOrMaterializeOccurrence(
      getRepositories(),
      session.userId,
      occurrenceId,
    )
    if (occurrence === null) {
      throw new NotFoundError('A ocorrência solicitada não existe.')
    }
    const recurrence = await recurrenceReader.findById(session.userId, occurrence.recurrenceId)
    if (recurrence === null) {
      throw new NotFoundError('A série desta ocorrência não existe.')
    }

    const paidAmount = cents(body.paidAmount)
    const paymentDate = isoDate(body.paymentDate)
    const { newEntry, outcome } = payOccurrence({ recurrence, occurrence, paidAmount, paymentDate })
    // Pago à mão numa conta vinculada é aceito (dono, 2026-10-09): o
    // lançamento que nasce aqui é Pago, e a sincronização o casa com a
    // transação do banco em vez de importá-la de novo.

    // ADR-0017 §5, "Redirecionar o valor extra": RECUSADO, não ignorado — e a
    // razão é de contabilidade, não de esforço.
    //
    // O dinheiro extra de um pagamento a maior SAIU da conta da pessoa e foi
    // para quem recebeu: pagar R$ 1.700 de um aluguel de R$ 1.500 entrega
    // R$ 1.700 ao locador. Creditar um investimento com esses R$ 200 subiria o
    // Patrimônio Líquido em dinheiro que a pessoa não tem mais — a mesma classe
    // de defeito que o §4.1 existe para impedir.
    //
    // O caso em que a opção faz sentido é o que files_design/02 descreve:
    // "se for parcela de Passivo, Redirecionar → Passivo cobre amortização
    // extraordinária". Só que a escolha de pagamento a maior existe APENAS no
    // diálogo de recorrência (`mark-occurrence-paid-dialog.tsx`); a rota de
    // parcela (`/installments/{id}/payment`) nem aceita o campo. O caso que
    // justifica a opção não é alcançável de onde ela está.
    if (body.overpaymentChoice === 'RedirectExtra') {
      throw new Error('overpayment.redirect_not_supported')
    }

    // ADR-0017 §5: "Descontar da próxima ocorrência" reduz o previsto do mês
    // seguinte. A ocorrência do mês seguinte pode não estar materializada ainda
    // (ADR-0004: a visita ao mês é que materializa), então o alvo vem da
    // materializada OU da virtual que o motor gera — nesta ordem, porque uma
    // edição anterior só existe na materializada.
    //
    // Calculado AQUI, antes da transação, porque `deductFromNextOccurrence`
    // recusa em três casos que o modelo admite e a fonte não cobre. Recusar
    // depois de gravar o pagamento deixaria a pessoa com o pagamento no banco e
    // um erro na tela — e reenviar gravaria o pagamento duas vezes.
    const deducao =
      body.overpaymentChoice === 'DeductFromNext' && outcome?.kind === 'Overpaid'
        ? await (async () => {
            const proximoMes = nextMonth(occurrence.month)
            const virtual = occurrenceOfMonth(recurrence, proximoMes)
            const materializada = await occurrenceReader.findById(
              session.userId,
              occurrenceIdFor(recurrence.id, proximoMes),
            )
            return deductFromNextOccurrence(materializada ?? virtual, outcome.excess)
          })()
        : null

    const stored = await withTransaction(
      async ({ entryWriter, occurrenceWriter, traceEventWriter, paymentDiscrepancyWriter }) => {
        if (deducao !== null) {
          // `create` é get-or-create idempotente pelo id derivado
          // (recurrences.repository.ts): materializa o mês seguinte se ele
          // ainda não existir, e o `replace` seguinte grava o valor reduzido.
          await occurrenceWriter.create(session.userId, deducao)
          await occurrenceWriter.replace(session.userId, deducao)
        }
        const storedEntry = await entryWriter.create(session.userId, newEntry)
        const paidOccurrence = occurrencePaidWith(occurrence, storedEntry.id, paidAmount)
        const replacedOccurrence = await occurrenceWriter.replace(session.userId, paidOccurrence)

        // `null` only for a "a definir" occurrence paid the first time — no
        // planned value to compare against, so nothing diverged (PRD §5).
        if (outcome !== null) {
          const recurrenceOrigin = { kind: 'Recurrence' as const, recurrenceId: recurrence.id }
          const subject = await entrySubject(storedEntry, categoryReader, session.userId)
          const eventId = asId<TraceEventId>(randomUUID())

          const traceEvent =
            outcome.kind === 'Exact'
              ? buildTraceEvent('RecurrencePaid', recurrenceOrigin, {
                  id: eventId,
                  date: paymentDate,
                  subject,
                })
              : buildTraceEvent('Discrepancy', recurrenceOrigin, {
                  id: eventId,
                  date: paymentDate,
                  subject,
                  // `outcome !== null` guarantees `payOccurrence` had a planned
                  // value to compare against, i.e. `occurrence.plannedAmount`.
                  plannedAmount: occurrence.plannedAmount!,
                  paidAmount,
                })
          await traceEventWriter.append(session.userId, traceEvent)

          // "pago a menos SEMPRE vira Pendência; pago a mais NUNCA vira" — the
          // asymmetry lives in `pendingItemFromPaymentOutcome`, not here.
          const entryOrigin = { kind: 'Entry' as const, entryId: storedEntry.id }
          const newDiscrepancy = pendingItemFromPaymentOutcome(outcome, entryOrigin, paymentDate)
          if (newDiscrepancy !== null) {
            await paymentDiscrepancyWriter.create(session.userId, newDiscrepancy)
          }
        }

        return replacedOccurrence
      },
    )

    return ok(stored)
  },
})
