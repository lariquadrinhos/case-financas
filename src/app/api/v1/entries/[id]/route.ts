/**
 * `GET, PATCH, DELETE /api/v1/entries/{id}` — one Lançamento.
 *
 * `DELETE` answers 409 (via `entries.in_use`, mapped in `src/api/http.ts`)
 * when an occurrence still points at this entry as the one it produced when
 * it was marked Pago (schema.ts `occurrences.entry_id`, RESTRICT).
 */

import { applyEntryPatch } from '@/domain/entries'
import { DISCRETIONARY_CATEGORY_ID } from '@/domain/chart-of-accounts'
import type { Entry } from '@/domain/entries'
import { asId, type EntryId } from '@/domain/core'
import { getRepositories, withTransaction } from '@/data'
import { closeRecurrence, occurrencesDiscardedByClosure } from '@/domain/recurrence'
import { withLinkedToBank } from '@/api/bank-link'
import { handler } from '@/api/handler'
import { assertCategoryFitsKind } from '@/api/entry-category'
import { NotFoundError, noContent, ok } from '@/api/http'
import { entryDeleteQuerySchema, entryPatchSchema } from '@/api/contracts/entries'
import { idParams } from '@/api/contracts/common'

export const GET = handler({
  operation: 'entries.read',
  params: idParams,
  handle: async ({ session, params }) => {
    const { entryReader } = getRepositories()
    const entry = await entryReader.findById(session.userId, asId<EntryId>(params.id))
    if (entry === null) {
      throw new NotFoundError('O lançamento solicitado não existe.')
    }
    const [withFlag] = await withLinkedToBank(getRepositories(), session.userId, [entry])
    return ok(withFlag)
  },
})

export const PATCH = handler({
  operation: 'entries.update',
  params: idParams,
  body: entryPatchSchema,
  handle: async ({ session, params, body }) => {
    const { entryReader } = getRepositories()
    const entryId = asId<EntryId>(params.id)
    const existing = await entryReader.findById(session.userId, entryId)
    if (existing === null) {
      throw new NotFoundError('O lançamento solicitado não existe.')
    }

    // `recurrence` is form-only (files_design/03 "Objeto Recorrência" lives on
    // Novo Lançamento, not on Editar): the série link is managed through the
    // recurrence endpoints, never rewritten by a plain field edit here.
    const { recurrence: _recurrence, ...patch } = body
    const patched = applyEntryPatch(existing, patch as Partial<Entry> & { kind: Entry['kind'] })
    await assertCategoryFitsKind(getRepositories(), session.userId, patched)
    const undoingPayment = existing.status === 'Paid' && patched.status === 'Planned'
    // "Desfazer" (dono, 2026-10-06): o que o banco pagou é o fato que ele
    // informou (ADR-0020) — voltá-lo a Previsto contradiria o extrato, e a
    // próxima sincronização não o pagaria de novo, porque já está importado.
    if (undoingPayment) {
      const records = await getRepositories().importedTransactionReader.listRecords(session.userId)
      if (records.some((record) => record.entryId === existing.id)) {
        throw new Error('entries.paid_by_bank')
      }
    }

    return withTransaction(
      async ({
        importedTransactionWriter,
        paymentDiscrepancyReader,
        paymentDiscrepancyWriter,
        discretionaryExpenseWriter,
        entryWriter,
        occurrenceReader,
        occurrenceWriter,
        recurrenceReader,
        recurrenceWriter,
      }) => {
        // Fora do Consumo Livre, fora do widget (dono, 2026-10-06): o
        // lançamento fica, na categoria nova.
        if (
          'categoryId' in existing &&
          'categoryId' in patched &&
          existing.categoryId === DISCRETIONARY_CATEGORY_ID &&
          patched.categoryId !== DISCRETIONARY_CATEGORY_ID
        ) {
          await discretionaryExpenseWriter.detach(session.userId, existing.id)
        }
        if (undoingPayment) {
          // A Pendência "pago a menos" fala de um pagamento que deixou de
          // existir; ficaria pedindo a diferença de algo ainda Previsto.
          const open = await paymentDiscrepancyReader.listByStatus(session.userId, 'Pending')
          for (const discrepancy of open) {
            if (discrepancy.origin.entryId === existing.id) {
              await paymentDiscrepancyWriter.remove(session.userId, discrepancy.id)
            }
          }
        }
        if (patched.recurrenceId !== null) {
          const recurrenceId = patched.recurrenceId
          const linked = (
            await occurrenceReader.listByRecurrence(session.userId, recurrenceId)
          ).find((occurrence) => occurrence.entryId === existing.id)

          // Troca de Sub-tipo (2026-09-23): a série é do mesmo lançamento, então
          // os meses seguintes trocam junto — senão a próxima ocorrência voltaria
          // como o Sub-tipo antigo.
          if (patched.kind !== existing.kind) {
            const recurrence = await recurrenceReader.findById(session.userId, recurrenceId)
            if (recurrence !== null) {
              await recurrenceWriter.replace(session.userId, {
                ...recurrence,
                template: {
                  ...recurrence.template,
                  kind: patched.kind,
                } as typeof recurrence.template,
              })
            }
          }

          // ADR-0019: recorrente Previsto é a OCORRÊNCIA do mês, não um
          // lançamento. Pago → Previsto num pagamento de série devolve o mês à
          // Revisão; um lançamento Previsto ao lado dela contaria em dobro.
          if (linked !== undefined && existing.status === 'Paid' && patched.status === 'Planned') {
            const reopened = await occurrenceWriter.replace(session.userId, {
              ...linked,
              status: 'Planned',
              entryId: null,
              plannedDate: patched.date,
              plannedAmount: patched.amount,
              discarded: false,
            })
            await entryWriter.remove(session.userId, existing.id)
            return ok(reopened)
          }
        }
        // PRD v7.46: trocar a categoria de um lançamento vindo do banco é a
        // pessoa categorizando — o "Reimportar" passa a preservar essa escolha.
        // Para um lançamento que não veio do banco, não há registro e nada muda.
        if (
          'categoryId' in existing &&
          'categoryId' in patched &&
          existing.categoryId !== patched.categoryId
        ) {
          await importedTransactionWriter.markCategorizedByPerson(session.userId, existing.id)
        }
        return ok(await entryWriter.replace(session.userId, patched))
      },
    )
  },
})

export const DELETE = handler({
  operation: 'entries.remove',
  params: idParams,
  query: entryDeleteQuerySchema,
  handle: async ({ session, params, query }) => {
    const { entryReader } = getRepositories()
    const entryId = asId<EntryId>(params.id)
    const existing = await entryReader.findById(session.userId, entryId)
    if (existing === null) {
      throw new NotFoundError('O lançamento solicitado não existe.')
    }
    // "Descartar lançamento" (2026-09-23): um lançamento pago pela Revisão de
    // Recorrentes é apontado pela ocorrência do mês (RESTRICT), e o DELETE
    // respondia 409. A ocorrência é DESCARTADA — pula só aquele mês, como o
    // "Descartar" da Revisão (files_design/04) — em vez de voltar a Previsto,
    // que faria a Revisão pedir de novo o pagamento que a pessoa apagou.
    const closeSeries = query.closeRecurrence === 'true'
    await withTransaction(
      async ({
        entryWriter,
        occurrenceReader,
        occurrenceWriter,
        recurrenceReader,
        recurrenceWriter,
      }) => {
        if (existing.recurrenceId !== null) {
          const occurrences = await occurrenceReader.listByRecurrence(
            session.userId,
            existing.recurrenceId,
          )
          const linked = occurrences.find((occurrence) => occurrence.entryId === existing.id)
          if (linked !== undefined) {
            await occurrenceWriter.replace(session.userId, {
              ...linked,
              entryId: null,
              status: 'Planned',
              discarded: true,
            })
          }
          if (closeSeries) {
            // "Encerrar recorrência" a partir da data do lançamento descartado.
            const recurrence = await recurrenceReader.findById(
              session.userId,
              existing.recurrenceId,
            )
            if (recurrence !== null && recurrence.closedOn === null) {
              await recurrenceWriter.replace(
                session.userId,
                closeRecurrence(recurrence, existing.date),
              )
              const discarded = occurrencesDiscardedByClosure(
                await occurrenceReader.listByRecurrence(session.userId, existing.recurrenceId),
                existing.date,
              )
              if (discarded.length > 0)
                await occurrenceWriter.replaceMany(session.userId, discarded)
            }
          }
        }
        await entryWriter.remove(session.userId, entryId)
      },
    )
    return noContent()
  },
})
