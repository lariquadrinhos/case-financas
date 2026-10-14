/**
 * `GET /api/v1/open-finance/accounts/{providerAccountId}/transactions` — o que
 * se vê ao expandir uma conta no card Open Finance (pedido do dono,
 * 2026-09-29): os movimentos do mês que o banco informa e o que cada um virou
 * no Bigorna. Serve para reconhecer qual conta é qual antes de vincular, e
 * para conferir o que foi parar no DRE.
 *
 * Lido ao vivo do provedor, do dia 1º do mês corrente em diante. `outcome` é
 * `null` para o que ainda não foi importado (conta sem vínculo, ou chegou
 * depois da última sincronização).
 */

import type { ProviderAccountId } from '@/domain/open-finance'
import { isoDate, monthOf } from '@/domain/core'
import { getOpenFinanceReader, getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { list } from '@/api/http'
import { providerAccountParams } from '@/api/contracts/open-finance'
import { todayIsoDate } from '@/lib/clock'

export const GET = handler({
  operation: 'open_finance.list_account_transactions',
  params: providerAccountParams,
  handle: async ({ session, params }) => {
    const accountId = params.providerAccountId as ProviderAccountId
    const from = isoDate(`${monthOf(todayIsoDate())}-01`)
    const transactions = await getOpenFinanceReader().listTransactions(
      session.userId,
      accountId,
      from,
    )
    const records = await getRepositories().importedTransactionReader.listRecords(session.userId)
    const outcomeOf = new Map(
      records.map((r) => [
        r.transactionId,
        r.outcome === 'TransferCounterpart' ? 'Transfer' : r.outcome,
      ]),
    )
    return list(
      [...transactions]
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        .map((t) => ({
          id: t.id,
          date: t.date,
          description: t.description,
          amount: t.amount,
          direction: t.direction,
          providerCategory: t.providerCategory,
          outcome: outcomeOf.get(t.id) ?? null,
        })),
    )
  },
})
