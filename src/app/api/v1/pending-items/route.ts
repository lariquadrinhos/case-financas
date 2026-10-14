/**
 * `GET /api/v1/pending-items` — Pendência unificada (Event Storming H13).
 *
 * The Home card renders ONE list; this handler is where the join across the
 * four bounded contexts actually happens (docs/event-storming §"Bounded
 * contexts", contexto 7: "lê de dentro dos contextos 2 a 5"). Every source is
 * read exactly as its own screen reads it — `listByStatus(Pending)` for the
 * two statused aggregates, `list()` for occurrences (the domain rule decides
 * which ones qualify), `listAll()` for allocations, because "which months
 * might still have a saldo não alocado" has no other answer today. The actual
 * decision of what counts and how it sorts is `collectPendingItems`
 * (`@/domain/pending-items`) — this handler does not repeat that logic.
 */

import { collectPendingItems } from '@/domain/pending-items'
import {
  UNCATEGORIZED_EXPENSE_CATEGORY_ID,
  UNCATEGORIZED_REVENUE_CATEGORY_ID,
} from '@/domain/chart-of-accounts'
import {
  allowanceForMonth,
  hasLeftover,
  leftoverBroughtForward,
  leftoverOfMonth,
  pendingLeftover,
  totalSpent,
} from '@/domain/discretionary-spending'
import { monthOf, nextMonth, previousMonth } from '@/domain/core'
import type { Month } from '@/domain/core'
import { todayIsoDate } from '@/lib/clock'
import { pendingItemFor } from '@/domain/profit-allocation'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { list } from '@/api/http'

export const GET = handler({
  operation: 'pending_items.list',
  handle: async ({ session }) => {
    const {
      pendingAllocationReader,
      occurrenceReader,
      profitAllocationReader,
      paymentDiscrepancyReader,
      discretionarySpendingConfigReader,
      discretionaryExpenseReader,
      leftoverDirectionReader,
      entryReader,
      importedTransactionReader,
      bankAccountReader,
    } = getRepositories()

    const [
      allocations,
      occurrences,
      allocationsByMonth,
      discrepancies,
      config,
      gastos,
      direcionamentos,
    ] = await Promise.all([
      pendingAllocationReader.listByStatus(session.userId, 'Pending'),
      occurrenceReader.list(session.userId),
      profitAllocationReader.listAll(session.userId),
      paymentDiscrepancyReader.listByStatus(session.userId, 'Pending'),
      discretionarySpendingConfigReader.find(session.userId),
      discretionaryExpenseReader.listAll(session.userId),
      leftoverDirectionReader.list(session.userId),
    ])

    const unallocatedProfits = allocationsByMonth.flatMap((allocation) => {
      const pending = pendingItemFor(allocation)
      return pending === null ? [] : [{ item: pending, month: allocation.month }]
    })

    // P14 — a sobra de cada mês JÁ FECHADO que ainda está sem destino.
    //
    // Só meses fechados: o mês corrente ainda pode ser gasto, e "sobra" é o que
    // um mês fechado entrega ao seguinte. Os meses considerados são os que têm
    // gasto do widget (`listAll`), pelo mesmo motivo que a lista de lucro não
    // alocado sai de `listAll`: não há outra forma de saber quais existem.
    //
    // A verba de cada mês soma o que a pessoa trouxe da sobra do mês anterior —
    // e só isso, porque desde a P14 a sobra não sobe o teto sozinha.
    const atual = monthOf(todayIsoDate())
    // Do PRIMEIRO mês em que o widget foi usado até o mês anterior ao corrente
    // — e não só os meses que têm gasto. Um mês em que a pessoa não gastou nada
    // sobrou a verba INTEIRA, e é a sobra maior possível; filtrar por "meses
    // com gasto" a fazia desaparecer justamente no caso extremo.
    //
    // O primeiro mês com gasto é o piso porque antes dele não havia uso: sem
    // ele, configurar o Consumo Livre hoje geraria pendência para todo mês
    // desde sempre.
    const mesesComGasto = mesesDoIntervalo(
      gastos.map((g) => monthOf(g.date)),
      atual,
    )
    // Com a verba = saldo da conta (2026-09-29) não há sobra: o que não foi
    // gasto continua na conta de origem, onde já conta.
    const discretionaryLeftovers =
      config === null || !hasLeftover(config)
        ? []
        : mesesComGasto.flatMap((mes) => {
            const trazido = leftoverBroughtForward(direcionamentos, previousMonth(mes))
            const verba = allowanceForMonth(config, trazido)
            const gasto = totalSpent(gastos.filter((g) => monthOf(g.date) === mes))
            const sobra = leftoverOfMonth(verba, gasto)
            const restante = pendingLeftover(sobra, direcionamentos, mes)
            return restante > 0 ? [{ month: mes, remaining: restante }] : []
          })

    // PRD v7.46 — o que veio do banco e ainda está em "A categorizar", contado
    // pelo mês CONTÁBIL do lançamento (PRD §5), que é o mês do DRE em que ele
    // aparece.
    const semCategoria = []
    for (const categoryId of [
      UNCATEGORIZED_EXPENSE_CATEGORY_ID,
      UNCATEGORIZED_REVENUE_CATEGORY_ID,
    ]) {
      const found = await entryReader.search(session.userId, {
        status: null,
        view: null,
        month: null,
        categoryId,
        classification: null,
        bankAccountId: null,
        recurring: null,
      })
      semCategoria.push(...found.items)
    }
    const porMes = new Map<Month, number>()
    for (const entry of semCategoria) {
      const mes = monthOf(entry.date)
      porMes.set(mes, (porMes.get(mes) ?? 0) + 1)
    }

    // 2026-09-29 — transferências entre PJ e PF que a pessoa ainda não
    // classificou. As entidades são as das contas de HOJE: renomear ou mudar a
    // entidade de uma conta muda a pergunta, e a pergunta é da pessoa.
    const contas = new Map((await bankAccountReader.list(session.userId)).map((a) => [a.id, a]))
    const unclassifiedTransfers = (await importedTransactionReader.listRecords(session.userId))
      .filter((r) => r.outcome === 'Transfer' && r.transferKind === 'Unclassified')
      .flatMap((r) => {
        const from = r.fromBankAccountId ? contas.get(r.fromBankAccountId) : undefined
        const to = r.toBankAccountId ? contas.get(r.toBankAccountId) : undefined
        if (from === undefined || to === undefined || from.entity === to.entity) return []
        return [
          {
            date: r.date,
            amount: r.amount,
            item: {
              transactionId: r.transactionId,
              from: from.entity,
              to: to.entity,
              fromBankAccountId: from.id,
              toBankAccountId: to.id,
              description: r.description,
            },
          },
        ]
      })

    const items = collectPendingItems({
      unclassifiedTransfers,
      uncategorized: [...porMes].map(([month, count]) => ({ month, count })),
      allocations,
      occurrences,
      unallocatedProfits,
      discrepancies,
      discretionaryLeftovers,
    })
    return list(items)
  },
})

/**
 * Os meses fechados desde o primeiro uso do widget. `[]` quando ele nunca foi
 * usado — sem uso não há verba consumida, e portanto não há sobra a decidir.
 */
function mesesDoIntervalo(mesesComGasto: readonly Month[], atual: Month): Month[] {
  if (mesesComGasto.length === 0) return []
  const primeiro = [...mesesComGasto].sort()[0]!
  const meses: Month[] = []
  for (let m = primeiro; m < atual; m = nextMonth(m)) meses.push(m)
  return meses
}
