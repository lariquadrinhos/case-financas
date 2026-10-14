/**
 * `GET /api/v1/open-finance/month-movement?month=YYYY-MM` — o quanto o extrato
 * de cada Conta Bancária vinculada se moveu no mês (entradas − saídas). O
 * "Caixa do mês" do DRE o usa para chegar ao saldo do dia 1º: saldo de hoje
 * menos o movimento (dono, 2026-10-09: "queria ver o Lucro Líquido + o caixa
 * do mês para entender o dinheiro do mês"). O Bigorna guarda só o saldo atual
 * de cada conta; o histórico dela é o extrato.
 *
 * Lê o provedor, como a sincronização (ADR-0020 §6, sob demanda): só quando o
 * card pede. O cartão não entra — compra no cartão não move a conta corrente.
 */

import { month as toMonth, isoDate, type BankAccountId } from '@/domain/core'
import { getOpenFinanceReader, getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { list } from '@/api/http'
import { monthSchema } from '@/api/contracts/common'
import { z } from '@/api/registry'

export const GET = handler({
  operation: 'open_finance.month_movement',
  query: z.strictObject({ month: monthSchema }),
  handle: async ({ session, query }) => {
    const month = toMonth(query.month)
    const from = isoDate(`${month}-01`)
    const links = await getRepositories().openFinanceLinkReader.list(session.userId)
    const reader = getOpenFinanceReader()
    const movement = new Map<BankAccountId, number>()
    for (const link of links) {
      if (link.target.kind !== 'BankAccount') continue
      const transactions = await reader.listTransactions(
        session.userId,
        link.providerAccountId,
        from,
      )
      const sum = transactions
        .filter((t) => t.date.startsWith(month))
        .reduce((total, t) => total + (t.direction === 'In' ? t.amount : -t.amount), 0)
      const id = link.target.bankAccountId
      movement.set(id, (movement.get(id) ?? 0) + sum)
    }
    return list([...movement].map(([bankAccountId, value]) => ({ bankAccountId, movement: value })))
  },
})
