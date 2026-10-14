/**
 * `GET /api/v1/open-finance/entry-origins?month=YYYY-MM` — de onde veio cada
 * lançamento do mês que o banco informou: a descrição real e a categoria do
 * banco (pedido do dono, 2026-09-29: "quero a descrição de fato do que é").
 * É o que o DRE mostra ao abrir uma categoria, para a pessoa categorizar
 * (PRD v7.46).
 *
 * O mês é o mês CONTÁBIL do lançamento (`listByMonth`, PRD §5): uma compra do
 * cartão aparece no mês do pagamento da fatura, não no mês da compra. Um
 * lançamento feito à mão não tem registro e não aparece aqui.
 */

import { month } from '@/domain/core'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { list } from '@/api/http'
import { monthSchema } from '@/api/contracts/common'
import { z } from '@/api/registry'

export const GET = handler({
  operation: 'open_finance.entry_origins',
  query: z.strictObject({ month: monthSchema }),
  handle: async ({ session, query }) => {
    const { entryReader, importedTransactionReader } = getRepositories()
    const entries = await entryReader.listByMonth(session.userId, month(query.month))
    const kindOf = new Map<string, string>(entries.map((e) => [e.id, e.kind]))
    const records = await importedTransactionReader.listRecords(session.userId)
    return list(
      records
        .filter((r) => r.entryId !== null && kindOf.has(r.entryId))
        .map((r) => ({
          entryId: r.entryId,
          // O PATCH de lançamento exige o `kind`: é o que o DRE manda ao trocar a categoria.
          kind: kindOf.get(r.entryId!)!,
          date: r.date,
          description: r.description,
          providerCategory: r.providerCategory ?? null,
        })),
    )
  },
})
