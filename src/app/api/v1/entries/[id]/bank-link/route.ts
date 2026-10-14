/**
 * `GET, POST /api/v1/entries/{id}/bank-link` — "Vincular ao banco" (dono,
 * 2026-10-09: "associar um depósito manual ao open finance para não ter
 * duplicidade e ter rastreabilidade").
 *
 * O casamento automático da sincronização (P49) só liga mesmo valor e até 5
 * dias; fora disso a transação vira um segundo lançamento. Aqui a pessoa
 * escolhe a transação. Valor e data passam a ser os do banco (decisão do dono:
 * o extrato é o fato, ADR-0020); categoria e descrição continuam as dela.
 */

import { asId, type EntryId } from '@/domain/core'
import { markAsPaid } from '@/domain/entries'
import { getRepositories, withTransaction } from '@/data'
import { handler } from '@/api/handler'
import { NotFoundError, list, ok } from '@/api/http'
import { candidatesFor, withLinkedToBank } from '@/api/bank-link'
import { bankLinkBodySchema } from '@/api/contracts/entries'
import { idParams } from '@/api/contracts/common'

async function entryOrNotFound(userId: Parameters<typeof candidatesFor>[1], id: string) {
  const entry = await getRepositories().entryReader.findById(userId, asId<EntryId>(id))
  if (entry === null) throw new NotFoundError('O lançamento solicitado não existe.')
  return entry
}

export const GET = handler({
  operation: 'entries.bank_link_candidates',
  params: idParams,
  handle: async ({ session, params }) => {
    const entry = await entryOrNotFound(session.userId, params.id)
    const candidates = await candidatesFor(getRepositories(), session.userId, entry)
    return list(
      candidates.map((c) => ({
        transactionId: c.transactionId,
        date: c.date,
        amount: c.amount,
        description: c.description,
        providerCategory: c.providerCategory ?? null,
      })),
    )
  },
})

export const POST = handler({
  operation: 'entries.bank_link',
  params: idParams,
  body: bankLinkBodySchema,
  handle: async ({ session, params, body }) => {
    const entry = await entryOrNotFound(session.userId, params.id)
    const candidate = (await candidatesFor(getRepositories(), session.userId, entry)).find(
      (c) => c.transactionId === body.transactionId,
    )
    if (candidate === undefined || candidate.entryId === null) {
      throw new Error('entries.not_a_bank_link_candidate')
    }
    const duplicateId = candidate.entryId

    const linked = await withTransaction(async ({ entryWriter, importedTransactionWriter }) => {
      const paid = markAsPaid(entry, candidate.amount, candidate.date).entry
      const stored = await entryWriter.replace(session.userId, {
        ...paid,
        // A descrição da pessoa vale mais que a do banco, como no casamento automático.
        description: entry.description || candidate.description.trim().slice(0, 200) || null,
      })
      await importedTransactionWriter.relink(session.userId, candidate.transactionId, entry.id)
      await entryWriter.remove(session.userId, duplicateId)
      return stored
    })
    const [withFlag] = await withLinkedToBank(getRepositories(), session.userId, [linked])
    return ok(withFlag)
  },
})
