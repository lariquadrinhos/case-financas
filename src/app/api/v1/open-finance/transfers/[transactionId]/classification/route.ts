/**
 * `POST /api/v1/open-finance/transfers/{transactionId}/classification` — a
 * pessoa diz o que foi uma transferência entre a PJ e a PF (2026-09-29).
 *
 * Pró-labore e Distribuição de lucro criam o Lançamento intercompany com as
 * duas contas, Pago na data do banco (`entryForTransferClassification`). Aporte
 * na PJ e Só transferência não criam nada: ficam fora do DRE. A escolha fica
 * gravada no registro da importação, e o "Reimportar" a preserva.
 */

import { isoDate } from '@/domain/core'
import {
  entryForTransferClassification,
  TRANSFER_CLASSIFICATIONS,
  type ProviderTransactionId,
} from '@/domain/open-finance'
import { getRepositories, withTransaction } from '@/data'
import { handler } from '@/api/handler'
import { NotFoundError, ok } from '@/api/http'
import { z } from '@/api/registry'

export const POST = handler({
  operation: 'open_finance.classify_transfer',
  params: z.strictObject({ transactionId: z.string().min(1).max(64) }),
  body: z.strictObject({ classification: z.enum(TRANSFER_CLASSIFICATIONS) }),
  handle: async ({ session, params, body }) => {
    const { importedTransactionReader, bankAccountReader } = getRepositories()
    const record = (await importedTransactionReader.listRecords(session.userId)).find(
      (r) => r.transactionId === params.transactionId && r.outcome === 'Transfer',
    )
    if (record === undefined || !record.fromBankAccountId || !record.toBankAccountId) {
      throw new NotFoundError('A transferência informada não existe.')
    }
    const from = await bankAccountReader.findById(session.userId, record.fromBankAccountId)
    const to = await bankAccountReader.findById(session.userId, record.toBankAccountId)
    if (from === null || to === null) {
      throw new NotFoundError('Uma das contas desta transferência não existe mais.')
    }

    const newEntry = entryForTransferClassification(
      body.classification,
      {
        amount: record.amount,
        date: isoDate(record.date),
        fromBankAccountId: from.id,
        toBankAccountId: to.id,
        description: record.description,
      },
      { from: from.entity, to: to.entity },
    )

    const entry = await withTransaction(async (repos) => {
      const created =
        newEntry === null ? null : await repos.entryWriter.create(session.userId, newEntry)
      await repos.importedTransactionWriter.classifyTransfer(
        session.userId,
        record.transactionId as ProviderTransactionId,
        body.classification,
        created?.id ?? null,
      )
      return created
    })
    return ok({ classification: body.classification, entry })
  },
})
