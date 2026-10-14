/**
 * Pendência unificada — turning the four origins into one sorted list
 * (Event Storming H13; files_design/08 §9.1).
 *
 * Two rules matter more than the others:
 *
 *  - `pendingItemFromPaymentOutcome` is "a política mais importante do domínio
 *    nesta rodada" (Event Storming, Fluxo I): pago a menos ALWAYS becomes a
 *    Pendência, pago a mais NEVER does. Getting the sign backwards here is the
 *    textbook bug this module exists to prevent.
 *  - `collectPendingItems` is H13 itself: one list, oldest first, across
 *    sources that otherwise have nothing in common but a date and an amount.
 */

import type { UnclassifiedTransferPendingItem } from './types'
import { isoDate } from '@/domain/core'
import type { Cents, IsoDate, Month } from '@/domain/core'
import type { PaymentOutcome } from '@/domain/entries'
import type { PendingAllocation } from '@/domain/assets'
import type { Occurrence } from '@/domain/recurrence'
import type { UnallocatedProfitPendingItem } from '@/domain/profit-allocation'

import type {
  NewPaymentDiscrepancy,
  PaymentDiscrepancyOrigin,
  PaymentDiscrepancyPendingItem,
  PendingItem,
} from './types'

/* -------------------------------------------------------------------------
 * Tipo 4 — a política de "pago a menos"
 * ---------------------------------------------------------------------- */

/**
 * `outcome.kind === 'Underpaid'` is the ONLY case that produces a Pendência.
 * `Exact` and `Overpaid` both return `null` — an `Overpaid` still produces a
 * `TraceEvent` (files_design/03), but never this record, per the asymmetry the
 * whole product hinges on: "sobra" nunca vira cobrança.
 */
export function pendingItemFromPaymentOutcome(
  outcome: PaymentOutcome,
  origin: PaymentDiscrepancyOrigin,
  paymentDate: IsoDate,
): NewPaymentDiscrepancy | null {
  if (outcome.kind !== 'Underpaid') return null
  return { origin, shortfall: outcome.shortfall, originDate: paymentDate, status: 'Pending' }
}

/** "Pagar" — the only action a `PaymentDiscrepancyPendingItem` offers (PRD §5). */
export function resolvePaymentDiscrepancy(
  item: PaymentDiscrepancyPendingItem,
): PaymentDiscrepancyPendingItem {
  if (item.status !== 'Pending') {
    throw new Error('payment_discrepancy.already_resolved')
  }
  return { ...item, status: 'Resolved' }
}

/* -------------------------------------------------------------------------
 * Um PendingItem por origem — cada função devolve `null` quando aquela
 * instância específica não é, hoje, uma Pendência.
 * ---------------------------------------------------------------------- */

export function pendingItemFromAllocation(pending: PendingAllocation): PendingItem | null {
  if (pending.status !== 'Pending') return null
  return {
    kind: 'AssetSaleAllocation',
    date: pending.originDate,
    amount: pending.amount,
    item: pending,
  }
}

/**
 * Tipo 2 — "Ocorrência 'a definir' sem valor" (Event Storming Fluxo I). Not a
 * stored record: recomputed straight from `Occurrence.plannedAmount === null`.
 * A discarded occurrence is not shown — "Descartar" is itself how the person
 * resolved it (files_design/01 §6), and an already-paid one is no longer
 * Previsto at all.
 */
export function pendingItemFromOccurrence(occurrence: Occurrence): PendingItem | null {
  if (occurrence.discarded) return null
  if (occurrence.status !== 'Planned') return null
  if (occurrence.plannedAmount !== null) return null
  return {
    kind: 'UndefinedOccurrence',
    date: occurrence.plannedDate,
    amount: null,
    item: occurrence,
  }
}

/**
 * Tipo 3 — "Saldo não alocado da Destinação do Lucro". `UnallocatedProfitPendingItem`
 * carries no date of its own (it is derived fresh from a `ProfitAllocation`,
 * `@/domain/profit-allocation` `pendingItemFor`); the first day of its month is
 * used for the oldest-first ordering.
 *
 * P26 (produto, 2026-09-09) — **a data de uma Pendência é a data do FATO que a
 * originou**, e quando esse fato é um mês inteiro, é o primeiro dia dele.
 *
 * Três dos cinco tipos já tinham data real: a venda (`originDate`), a ocorrência
 * (`plannedDate`) e a divergência (`originDate`). Os dois sintéticos — lucro não
 * destinado e sobra do Consumo Livre — tratam de um MÊS, não de um instante, e
 * por isso usam `YYYY-MM-01`. Não é substituto provisório: é a data do fato,
 * na precisão que o fato tem.
 *
 * Guardar um carimbo de tempo real foi recusado: a pendência é DERIVADA, não
 * existe um instante de criação para carimbar, e um carimbo de "última vez que
 * a destinação foi salva" ordenaria por "mexido mais recentemente" em vez de
 * "mês mais antigo em aberto" — pior para o propósito da lista.
 *
 * Escopo medido: o Figma não desenha data em NENHUM
 * dos quatro tipos de Pendência — Wireframe `115:2` (cartões `115:5`, `115:11`,
 * `115:17`, `151:2`), Mockup `549:75`, Vazio `309:2`, Carregando `309:26` —
 * enquanto o card vizinho Eventos Recentes, na mesma Home, imprime `dd/mm/aaaa`
 * (`150:7`). Esta data portanto nunca chega à tela: ela é só a chave da ordem
 * "mais antiga primeiro" (PRD §"Pendência", files_design/08 §9.1). O primeiro
 * dia do mês é um substituto; a pergunta aberta afeta apenas a ORDEM entre
 * pendências de lucro de meses diferentes, jamais o texto que a pessoa lê — o
 * mês por extenso, que o desenho exige (`115:19` / `549:93`), vem de
 * `item.month`, não daqui.
 */
export function pendingItemFromUnallocatedProfit(
  item: UnallocatedProfitPendingItem,
  month: Month,
): PendingItem {
  return { kind: 'UnallocatedProfit', date: isoDate(`${month}-01`), amount: item.amount, item }
}

/**
 * P14 (produto, 2026-09-08) — a sobra do Consumo Livre vira Pendência.
 *
 * `null` quando não sobrou nada ou quando tudo já foi direcionado: sem valor
 * sem destino, não há decisão a pedir. É o mesmo formato de
 * `pendingItemFromAllocation`, e por isso a sub-pergunta "e se a sobra for
 * zero, a linha aparece com R$ 0,00?" deixa de existir.
 *
 * A data segue a regra única da P26 (produto, 2026-09-09): **a data do FATO que
 * originou a pendência**. Aqui o fato é "este mês sobrou dinheiro", então é o
 * primeiro dia do mês de ORIGEM — não o do mês seguinte, em que ela virou
 * decisão. Uma sobra de junho é assunto mais antigo que o lucro de julho, e
 * ordenar por origem é o que diz isso.
 *
 * A data nunca chega à tela: nenhum dos cartões de Pendência desenha data
 * (escopo medido na P26), então ela é só a chave da ordem.
 */
export function pendingItemFromDiscretionaryLeftover(
  month: Month,
  remaining: Cents,
): PendingItem | null {
  if (remaining <= 0) return null
  return {
    kind: 'DiscretionaryLeftover',
    date: isoDate(`${month}-01`),
    amount: remaining,
    item: { month, remaining },
  }
}

export function pendingItemFromDiscrepancy(
  discrepancy: PaymentDiscrepancyPendingItem,
): PendingItem | null {
  if (discrepancy.status !== 'Pending') return null
  return {
    kind: 'PaymentDiscrepancy',
    date: discrepancy.originDate,
    amount: discrepancy.shortfall,
    item: discrepancy,
  }
}

/* -------------------------------------------------------------------------
 * O read model
 * ---------------------------------------------------------------------- */

/**
 * "Ordenados da mais antiga para a mais nova" (PRD §1). Ties keep the order
 * `collectPendingItems` received them in (`Array.prototype.sort` is stable) —
 * no source ranks same-day pendências against each other.
 *
 * files_design/08 §9.1 flags this criterion itself as provisional ("o próprio
 * documento pede revisão"): correct today, not a closed decision.
 */
export function sortPendingItems(items: readonly PendingItem[]): PendingItem[] {
  return [...items].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/**
 * The one list the Home card renders (H13). Callers pass in whatever they
 * already fetched from each of the four sources — this function does not read
 * anything and does not know how "Pending" is queried per source; it only
 * knows how to turn what is Pending into ONE sorted shape.
 */
export function collectPendingItems(sources: {
  readonly allocations: readonly PendingAllocation[]
  readonly occurrences: readonly Occurrence[]
  readonly unallocatedProfits: readonly {
    readonly item: UnallocatedProfitPendingItem
    readonly month: Month
  }[]
  readonly discrepancies: readonly PaymentDiscrepancyPendingItem[]
  /**
   * P14 — a sobra ainda sem destino de cada mês fechado, já calculada pelo
   * chamador (`pendingLeftover`): o cálculo precisa da verba e dos gastos
   * daquele mês, que vivem em `discretionary-spending`, e este contexto não os
   * importa (a mesma razão pela qual `unallocatedProfits` chega pronto).
   */
  readonly discretionaryLeftovers?: readonly {
    readonly month: Month
    readonly remaining: Cents
  }[]
  /** PRD v7.46 — quantos lançamentos de cada mês estão em "A categorizar". */
  readonly uncategorized?: readonly { readonly month: Month; readonly count: number }[]
  /** 2026-09-29 — transferências entre PJ e PF ainda sem classificação. */
  readonly unclassifiedTransfers?: readonly {
    readonly date: IsoDate
    readonly amount: Cents
    readonly item: UnclassifiedTransferPendingItem
  }[]
}): PendingItem[] {
  const items: PendingItem[] = []
  for (const allocation of sources.allocations) {
    const item = pendingItemFromAllocation(allocation)
    if (item !== null) items.push(item)
  }
  for (const occurrence of sources.occurrences) {
    const item = pendingItemFromOccurrence(occurrence)
    if (item !== null) items.push(item)
  }
  for (const { item: profit, month } of sources.unallocatedProfits) {
    items.push(pendingItemFromUnallocatedProfit(profit, month))
  }
  for (const discrepancy of sources.discrepancies) {
    const item = pendingItemFromDiscrepancy(discrepancy)
    if (item !== null) items.push(item)
  }
  for (const sobra of sources.discretionaryLeftovers ?? []) {
    const item = pendingItemFromDiscretionaryLeftover(sobra.month, sobra.remaining)
    if (item !== null) items.push(item)
  }
  for (const transfer of sources.unclassifiedTransfers ?? []) {
    items.push({ kind: 'UnclassifiedTransfer', ...transfer })
  }
  for (const { month, count } of sources.uncategorized ?? []) {
    if (count <= 0) continue
    items.push({
      kind: 'Uncategorized',
      date: isoDate(`${month}-01`),
      amount: null,
      item: { month, count },
    })
  }
  return sortPendingItems(items)
}
