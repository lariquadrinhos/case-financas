/**
 * `GET, POST /api/v1/entries` — Lançamento, the transactional root (PRD §5).
 *
 * `POST` is the one place a Recorrência is born: files_design/03 "Objeto
 * Recorrência" puts the toggle INSIDE the Novo Lançamento form, not in a
 * screen of its own — activating it creates the série (`templateFromEntry`)
 * in the same call that creates this month's own entry, and stamps the
 * entry's `recurrenceId` with the série it just started.
 */

import {
  asId,
  cents,
  isoDate,
  month,
  monthOf,
  type BankAccountId,
  type CategoryId,
  type RecurrenceId,
} from '@/domain/core'
import type { Entry, EntryFilter, NewEntry } from '@/domain/entries'
import { occurrenceOfMonth, templateFromEntry } from '@/domain/recurrence'
import type { NewRecurrence } from '@/data/contracts/recurrences'
import { getRepositories, withTransaction } from '@/data'
import { withLinkedToBank } from '@/api/bank-link'
import { handler } from '@/api/handler'
import { assertCategoryFitsKind } from '@/api/entry-category'
import { created, list, resourcePath } from '@/api/http'
import { entryQuerySchema, newEntrySchema } from '@/api/contracts/entries'
import type { z } from '@/api/registry'

type NewEntryBody = z.infer<typeof newEntrySchema>
type EntryQuery = z.infer<typeof entryQuerySchema>

/**
 * `body` matches `NewEntry` field for field once the form-only `recurrence`
 * toggle is set aside — see `src/domain/entries/types.ts` `NewEntry` against
 * each variant of `src/api/contracts/entries.ts` `newEntryVariants`.
 */
function toNewEntry(body: NewEntryBody, recurrenceId: RecurrenceId | null): NewEntry {
  const { recurrence: _recurrence, ...rest } = body
  return { ...rest, recurrenceId } as NewEntry
}

function toFilter(query: Omit<EntryQuery, 'limit' | 'offset'>): EntryFilter {
  return {
    status: query.status ?? null,
    view: query.view ?? null,
    month: query.month !== undefined ? month(query.month) : null,
    categoryId: query.categoryId !== undefined ? asId<CategoryId>(query.categoryId) : null,
    classification: query.classification ?? null,
    bankAccountId:
      query.bankAccountId !== undefined ? asId<BankAccountId>(query.bankAccountId) : null,
    recurring: query.recurring !== undefined ? query.recurring === 'true' : null,
  }
}

export const GET = handler({
  operation: 'entries.list',
  query: entryQuerySchema,
  handle: async ({ session, query }) => {
    const { entryReader } = getRepositories()
    const { limit, offset, ...rest } = query
    const result = await entryReader.search(session.userId, toFilter(rest), { limit, offset })
    return list(
      await withLinkedToBank(getRepositories(), session.userId, result.items),
      result.total,
    )
  },
})

export const POST = handler({
  operation: 'entries.create',
  body: newEntrySchema,
  handle: async ({ session, body }) => {
    // Pago à mão numa conta vinculada é aceito (dono, 2026-10-09: "deixa eu
    // marcar como pago"); a sincronização casa a transação com ele
    // (`importState`, src/api/open-finance.ts) em vez de duplicá-lo.
    await assertCategoryFitsKind(getRepositories(), session.userId, toNewEntry(body, null))
    if (body.recurrence === null) {
      const { entryWriter } = getRepositories()
      const stored: Entry = await entryWriter.create(session.userId, toNewEntry(body, null))
      return created(resourcePath('entries', stored.id), stored)
    }

    const recurrenceInput = body.recurrence
    const date = isoDate(body.date)
    const newRecurrence: NewRecurrence = {
      template: templateFromEntry(toNewEntry(body, null)),
      amountKind: recurrenceInput.amountKind,
      /**
       * ADR-0019: a série começa no MÊS DO LANÇAMENTO. Antes começava no mês
       * seguinte (UC13 na redação da v6), e o lançamento de origem nunca
       * aparecia na Revisão de Recorrentes — medido em 2026-09-23: quatro
       * séries lançadas para 15/10 só surgiam na Revisão em novembro.
       */
      startDate: date,
      endsOn: recurrenceInput.endsOn === null ? null : isoDate(recurrenceInput.endsOn),
    }

    return withTransaction(async ({ entryWriter, recurrenceWriter, occurrenceWriter }) => {
      const recurrence = await recurrenceWriter.create(session.userId, newRecurrence)
      const firstOccurrence = occurrenceOfMonth(recurrence, monthOf(date))
      if (firstOccurrence === null) {
        // `startDate = date` garante uma ocorrência no mês do próprio lançamento.
        throw new Error('recurrence.first_occurrence_missing')
      }
      const { id: _id, ...occurrence } = firstOccurrence
      // O valor digitado vale para este mês, mesmo numa série "a definir", que
      // só nasce em branco do mês seguinte em diante (PRD §5).
      const amount = cents(body.amount)

      if (body.status === 'Planned') {
        // ADR-0019: Previsto recorrente não é um lançamento avulso — a
        // ocorrência do mês o representa. Gravar os dois é a dupla contagem do
        // PRD §5 (o DRE Previsto projetaria a ocorrência E leria o lançamento).
        const stored = await occurrenceWriter.create(session.userId, {
          ...occurrence,
          plannedAmount: amount,
        })
        return created(resourcePath('occurrences', stored.id), stored)
      }

      // Pago: o lançamento existe, e a ocorrência do mês nasce paga e apontando
      // para ele — como "Marcar Pago" deixaria (`occurrencePaidWith`).
      const stored: Entry = await entryWriter.create(
        session.userId,
        toNewEntry(body, recurrence.id),
      )
      await occurrenceWriter.create(session.userId, {
        ...occurrence,
        status: 'Paid',
        plannedAmount: amount,
        entryId: stored.id,
      })
      return created(resourcePath('entries', stored.id), stored)
    })
  },
})
