/**
 * Pendência unificada — H13.
 *
 * `tests.inversions_verified`:
 *  1. `pendingItemFromPaymentOutcome` — inverted the `kind !== 'Underpaid'`
 *     guard to `kind === 'Underpaid'` negated the wrong way (`Exact`/`Overpaid`
 *     would have produced a Pendência and `Underpaid` would not). Confirmed
 *     RED on "pago a mais nunca vira Pendência" and "pago a menos sempre vira
 *     Pendência"; reverted; both green again.
 *  2. `collectPendingItems` — inverted `sortPendingItems`'s comparator
 *     (`a.date > b.date ? -1 : 1`, newest first). Confirmed RED on "ordena da
 *     mais antiga para a mais nova, através dos 4 tipos"; reverted; green again.
 */

import { describe, expect, it } from 'vitest'

import { asId, cents, isoDate, month } from '@/domain/core'
import type {
  EntryId,
  OccurrenceId,
  PaymentDiscrepancyId,
  PendingAllocationId,
  RecurrenceId,
  TangibleAssetId,
} from '@/domain/core'
import { paymentOutcomeOf } from '@/domain/entries'
import type { PendingAllocation } from '@/domain/assets'
import type { Occurrence } from '@/domain/recurrence'
import type { UnallocatedProfitPendingItem } from '@/domain/profit-allocation'

import {
  collectPendingItems,
  pendingItemFromAllocation,
  pendingItemFromDiscretionaryLeftover,
  pendingItemFromDiscrepancy,
  pendingItemFromOccurrence,
  pendingItemFromPaymentOutcome,
  pendingItemFromUnallocatedProfit,
  resolvePaymentDiscrepancy,
  sortPendingItems,
} from './rules'
import type { PaymentDiscrepancyPendingItem, PendingItem } from './types'

const ENTRY_ORIGIN = { kind: 'Entry' as const, entryId: asId<EntryId>('lancamento-1') }

function allocation(over: Partial<PendingAllocation> = {}): PendingAllocation {
  return {
    id: asId<PendingAllocationId>('pendente-1'),
    origin: { kind: 'TangibleAssetSale', tangibleAssetId: asId<TangibleAssetId>('carro') },
    amount: cents(5_000),
    originDate: isoDate('2026-07-10'),
    status: 'Pending',
    ...over,
  }
}

function occurrence(over: Partial<Occurrence> = {}): Occurrence {
  return {
    id: asId<OccurrenceId>('recorrencia-1:2026-07'),
    recurrenceId: asId<RecurrenceId>('recorrencia-1'),
    month: month('2026-07'),
    plannedDate: isoDate('2026-07-05'),
    plannedAmount: null,
    status: 'Planned',
    discarded: false,
    entryId: null,
    ...over,
  }
}

function discrepancy(
  over: Partial<PaymentDiscrepancyPendingItem> = {},
): PaymentDiscrepancyPendingItem {
  return {
    id: asId<PaymentDiscrepancyId>('divergencia-1'),
    origin: ENTRY_ORIGIN,
    shortfall: cents(2_000),
    originDate: isoDate('2026-07-12'),
    status: 'Pending',
    ...over,
  }
}

/* -------------------------------------------------------------------------
 * Tipo 4 — a política de "pago a menos"
 * ---------------------------------------------------------------------- */

describe('pendingItemFromPaymentOutcome — the central asymmetry (Event Storming Fluxo I)', () => {
  it('pago a menos SEMPRE vira Pendência', () => {
    const outcome = paymentOutcomeOf(cents(8_000), cents(10_000))
    const result = pendingItemFromPaymentOutcome(outcome, ENTRY_ORIGIN, isoDate('2026-07-12'))
    expect(result).toEqual({
      origin: ENTRY_ORIGIN,
      shortfall: cents(2_000),
      originDate: isoDate('2026-07-12'),
      status: 'Pending',
    })
  })

  it('pago a mais NUNCA vira Pendência', () => {
    const outcome = paymentOutcomeOf(cents(12_000), cents(10_000))
    expect(pendingItemFromPaymentOutcome(outcome, ENTRY_ORIGIN, isoDate('2026-07-12'))).toBeNull()
  })

  it('pago exatamente o previsto não vira Pendência', () => {
    const outcome = paymentOutcomeOf(cents(10_000), cents(10_000))
    expect(pendingItemFromPaymentOutcome(outcome, ENTRY_ORIGIN, isoDate('2026-07-12'))).toBeNull()
  })
})

describe('resolvePaymentDiscrepancy — "Pagar"', () => {
  it('marks a Pending discrepancy Resolved', () => {
    expect(resolvePaymentDiscrepancy(discrepancy()).status).toBe('Resolved')
  })

  it('refuses to resolve one already Resolved', () => {
    expect(() => resolvePaymentDiscrepancy(discrepancy({ status: 'Resolved' }))).toThrow(
      'payment_discrepancy.already_resolved',
    )
  })
})

/* -------------------------------------------------------------------------
 * Um PendingItem por origem
 * ---------------------------------------------------------------------- */

describe('pendingItemFromAllocation — tipo 1', () => {
  it('a Pending allocation becomes a PendingItem', () => {
    const source = allocation()
    expect(pendingItemFromAllocation(source)).toEqual({
      kind: 'AssetSaleAllocation',
      date: source.originDate,
      amount: source.amount,
      item: source,
    })
  })

  it('an Allocated one is not a Pendência anymore', () => {
    expect(pendingItemFromAllocation(allocation({ status: 'Allocated' }))).toBeNull()
  })
})

describe('pendingItemFromOccurrence — tipo 2', () => {
  it('a Planned, non-discarded, unfilled occurrence becomes a PendingItem', () => {
    const source = occurrence()
    expect(pendingItemFromOccurrence(source)).toEqual({
      kind: 'UndefinedOccurrence',
      date: source.plannedDate,
      amount: null,
      item: source,
    })
  })

  it('a filled-in occurrence is not pending — a value has been typed', () => {
    expect(pendingItemFromOccurrence(occurrence({ plannedAmount: cents(1_000) }))).toBeNull()
  })

  it('a discarded occurrence is not pending — descartar já resolveu', () => {
    expect(pendingItemFromOccurrence(occurrence({ discarded: true }))).toBeNull()
  })

  it('a Paid occurrence is not pending — it already has a value', () => {
    expect(
      pendingItemFromOccurrence(occurrence({ status: 'Paid', plannedAmount: cents(1_000) })),
    ).toBeNull()
  })
})

describe('pendingItemFromUnallocatedProfit — tipo 3', () => {
  it('uses the first day of the month as the sorting date', () => {
    const source: UnallocatedProfitPendingItem = {
      kind: 'UnallocatedProfit',
      month: month('2026-07'),
      amount: cents(3_000),
    }
    expect(pendingItemFromUnallocatedProfit(source, month('2026-07'))).toEqual({
      kind: 'UnallocatedProfit',
      date: isoDate('2026-07-01'),
      amount: cents(3_000),
      item: source,
    })
  })
})

describe('pendingItemFromDiscrepancy — tipo 4', () => {
  it('a Pending discrepancy becomes a PendingItem', () => {
    const source = discrepancy()
    expect(pendingItemFromDiscrepancy(source)).toEqual({
      kind: 'PaymentDiscrepancy',
      date: source.originDate,
      amount: source.shortfall,
      item: source,
    })
  })

  it('a Resolved one is gone from the list', () => {
    expect(pendingItemFromDiscrepancy(discrepancy({ status: 'Resolved' }))).toBeNull()
  })
})

/* -------------------------------------------------------------------------
 * O read model
 * ---------------------------------------------------------------------- */

describe('sortPendingItems — "mais antiga primeiro" (PRD §1, files_design/08 §9.1)', () => {
  it('orders ascending by date across every kind', () => {
    const newer = pendingItemFromAllocation(allocation({ originDate: isoDate('2026-07-20') }))!
    const older = pendingItemFromDiscrepancy(discrepancy({ originDate: isoDate('2026-07-01') }))!
    expect(sortPendingItems([newer, older])).toEqual([older, newer])
  })

  it('is stable on ties — same-day items keep the order they arrived in', () => {
    const first: PendingItem = pendingItemFromAllocation(
      allocation({ id: asId<PendingAllocationId>('a'), originDate: isoDate('2026-07-10') }),
    )!
    const second: PendingItem = pendingItemFromAllocation(
      allocation({ id: asId<PendingAllocationId>('b'), originDate: isoDate('2026-07-10') }),
    )!
    expect(sortPendingItems([first, second])).toEqual([first, second])
  })
})

describe('collectPendingItems — H13, the one list the Home renders', () => {
  it('combines all four kinds, drops what is resolved, sorted oldest first', () => {
    const oldAllocation = allocation({ originDate: isoDate('2026-06-01') })
    const resolvedAllocation = allocation({
      id: asId<PendingAllocationId>('resolvida'),
      status: 'Allocated',
    })
    const midOccurrence = occurrence({ plannedDate: isoDate('2026-07-05') })
    const filledOccurrence = occurrence({
      id: asId<OccurrenceId>('preenchida'),
      plannedAmount: cents(1_000),
    })
    const profit: UnallocatedProfitPendingItem = {
      kind: 'UnallocatedProfit',
      month: month('2026-07'),
      amount: cents(9_000),
    }
    const newDiscrepancy = discrepancy({ originDate: isoDate('2026-07-15') })
    const resolvedDiscrepancy = discrepancy({
      id: asId<PaymentDiscrepancyId>('quitada'),
      status: 'Resolved',
    })

    const result = collectPendingItems({
      allocations: [oldAllocation, resolvedAllocation],
      occurrences: [midOccurrence, filledOccurrence],
      unallocatedProfits: [{ item: profit, month: month('2026-07') }],
      discrepancies: [newDiscrepancy, resolvedDiscrepancy],
    })

    expect(result.map((item) => item.kind)).toEqual([
      'AssetSaleAllocation', // 2026-06-01
      'UnallocatedProfit', // 2026-07-01
      'UndefinedOccurrence', // 2026-07-05
      'PaymentDiscrepancy', // 2026-07-15
    ])
  })

  it('is empty when every source is empty — the Home shows its own empty state, not a broken list', () => {
    expect(
      collectPendingItems({
        allocations: [],
        occurrences: [],
        unallocatedProfits: [],
        discrepancies: [],
      }),
    ).toEqual([])
  })
})

/**
 * P26 (produto, 2026-09-09) — a data de uma Pendência é a data do FATO que a
 * originou; quando o fato é um mês inteiro, é o primeiro dia dele.
 *
 * Três dos cinco tipos já tinham data real (venda, ocorrência, divergência).
 * Os dois sintéticos tratam de um mês, e por isso usam `YYYY-MM-01` — não como
 * substituto provisório, mas porque é a data do fato na precisão que o fato
 * tem. A data nunca chega à tela (nenhum cartão desenha data, medido nos
 * frames): ela é só a chave da ordem "mais antiga primeiro".
 *
 * Este teste existe porque a sobra do Consumo Livre nasceu, um dia antes,
 * usando o mês SEGUINTE — o mês em que ela vira decisão. As duas convenções
 * pareciam igualmente defensáveis lidas isoladamente, e só a lista misturada
 * mostra a diferença: uma sobra de junho é assunto mais antigo que o lucro de
 * julho, e com a convenção antiga as duas empatavam.
 */
describe('a data de uma Pendência é a do fato que a originou (P26)', () => {
  it('a sobra de um mês usa o primeiro dia DAQUELE mês, não do seguinte', () => {
    const item = pendingItemFromDiscretionaryLeftover(month('2026-06'), cents(15_000))
    expect(item?.date).toBe('2026-06-01')
  })

  it('o lucro não destinado usa a mesma regra', () => {
    const item = pendingItemFromUnallocatedProfit(
      { kind: 'UnallocatedProfit', month: month('2026-07'), amount: cents(300_000) },
      month('2026-07'),
    )
    expect(item.date).toBe('2026-07-01')
  })

  it('e é isso que põe a sobra de junho ANTES do lucro de julho na lista', () => {
    const itens = collectPendingItems({
      allocations: [],
      occurrences: [],
      unallocatedProfits: [
        {
          item: { kind: 'UnallocatedProfit', month: month('2026-07'), amount: cents(300_000) },
          month: month('2026-07'),
        },
      ],
      discrepancies: [],
      discretionaryLeftovers: [{ month: month('2026-06'), remaining: cents(15_000) }],
    })

    expect(itens.map((i) => i.kind)).toEqual(['DiscretionaryLeftover', 'UnallocatedProfit'])
  })

  it('sem sobra não há pendência', () => {
    expect(pendingItemFromDiscretionaryLeftover(month('2026-06'), cents(0))).toBeNull()
  })
})

describe('Pendência "a categorizar" — PRD v7.46', () => {
  it('PRD v7.46 — o que veio do banco sem categoria vira UMA pendência por mês, com a contagem', () => {
    const items = collectPendingItems({
      allocations: [],
      occurrences: [],
      unallocatedProfits: [],
      discrepancies: [],
      uncategorized: [
        { month: month('2026-09'), count: 12 },
        { month: month('2026-08'), count: 0 },
      ],
    })
    expect(items).toEqual([
      {
        kind: 'Uncategorized',
        date: isoDate('2026-09-01'),
        amount: null,
        item: { month: '2026-09', count: 12 },
      },
    ])
  })
})
