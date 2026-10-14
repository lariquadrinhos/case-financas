import { describe, expect, it } from 'vitest'
import { asId, cents, month, ZERO } from '@/domain/core'
import type { BankAccountId, Cents, InvestmentId } from '@/domain/core'
import {
  addItem,
  allocatedTotal,
  bucketPercent,
  bucketSubtotal,
  canAddItem,
  canAllocate,
  canSave,
  emptyAllocation,
  isDestinationValidForBucket,
  pendingItemFor,
  percentOfProfit,
  removeItem,
  unallocatedBalance,
  unallocatedPercent,
} from './rules'
import { EMPTY_ALLOCATION_ITEMS } from './types'
import type { AllocationDestination, AllocationItem } from './types'

const MONTH = month('2026-07')
const INVESTMENT = asId<InvestmentId>('tesouro-direto')
const ACCOUNT = asId<BankAccountId>('conta-nubank-pf')

function investmentDestination(): AllocationDestination {
  return { kind: 'Investment', investmentId: INVESTMENT }
}

function accountDestination(): AllocationDestination {
  return { kind: 'BankAccount', bankAccountId: ACCOUNT }
}

function item(amount: Cents, destination: AllocationDestination | null = null): AllocationItem {
  return { destination, amount }
}

describe('canAllocate — files_design/01 §8.1/§9, "Sem lucro a destinar este mês"', () => {
  it('allows a positive net profit', () => {
    expect(canAllocate(cents(10_000))).toBe(true)
  })

  it('refuses a loss', () => {
    expect(canAllocate(cents(-1) as Cents)).toBe(false)
  })

  it('Figma 242:14 — não oferece alocação de algo que não existe: zero também não existe', () => {
    expect(canAllocate(ZERO)).toBe(false)
  })
})

describe('emptyAllocation — the state Destinar o Lucro opens in', () => {
  it('starts every one of the 4 cards empty', () => {
    const allocation = emptyAllocation(MONTH, cents(10_000))
    expect(allocation.items.InvestmentContribution).toEqual([])
    expect(allocation.items.DividendReinvestment).toEqual([])
    expect(allocation.items.ExtraordinaryConsumption).toEqual([])
    expect(allocation.items.CashReserve).toEqual([])
    expect(unallocatedBalance(allocation)).toBe(10_000)
  })
})

describe('bucketSubtotal / allocatedTotal — files_design/01 §9, "subtotal no cabeçalho"', () => {
  it('sums only the items of one card', () => {
    let allocation = emptyAllocation(MONTH, cents(100_000))
    allocation = addItem(
      allocation,
      'InvestmentContribution',
      item(cents(10_000), investmentDestination()),
    )
    allocation = addItem(
      allocation,
      'InvestmentContribution',
      item(cents(5_000), investmentDestination()),
    )
    allocation = addItem(allocation, 'CashReserve', item(cents(2_000), accountDestination()))

    expect(bucketSubtotal(allocation, 'InvestmentContribution')).toBe(15_000)
    expect(bucketSubtotal(allocation, 'CashReserve')).toBe(2_000)
    expect(bucketSubtotal(allocation, 'DividendReinvestment')).toBe(ZERO)
  })

  it('allocatedTotal sums every card', () => {
    let allocation = emptyAllocation(MONTH, cents(100_000))
    allocation = addItem(
      allocation,
      'InvestmentContribution',
      item(cents(10_000), investmentDestination()),
    )
    allocation = addItem(allocation, 'CashReserve', item(cents(2_000), accountDestination()))
    expect(allocatedTotal(allocation)).toBe(12_000)
  })
})

describe('unallocatedBalance — "Saldo não alocado" (files_design/03)', () => {
  it('is the net profit minus everything allocated, derived, never stored', () => {
    let allocation = emptyAllocation(MONTH, cents(50_000))
    allocation = addItem(allocation, 'ExtraordinaryConsumption', item(cents(20_000)))
    expect(unallocatedBalance(allocation)).toBe(30_000)
  })

  it('is the whole net profit when nothing was allocated', () => {
    expect(unallocatedBalance(emptyAllocation(MONTH, cents(50_000)))).toBe(50_000)
  })
})

describe('percentOfProfit / bucketPercent / unallocatedPercent — files_design/03 "% do lucro"', () => {
  it('computes the percentage an amount represents of the net profit', () => {
    const allocation = emptyAllocation(MONTH, cents(100_000))
    expect(percentOfProfit(allocation, cents(25_000))).toBeCloseTo(25)
  })

  it('is null when the profit is zero — a dash on screen, never NaN or Infinity', () => {
    const allocation = emptyAllocation(MONTH, ZERO)
    expect(percentOfProfit(allocation, cents(1_000))).toBeNull()
  })

  it('bucketPercent reads the subtotal of one card as a percentage', () => {
    let allocation = emptyAllocation(MONTH, cents(100_000))
    allocation = addItem(allocation, 'CashReserve', item(cents(40_000), accountDestination()))
    expect(bucketPercent(allocation, 'CashReserve')).toBeCloseTo(40)
  })

  it('unallocatedPercent reads the leftover as a percentage', () => {
    let allocation = emptyAllocation(MONTH, cents(100_000))
    allocation = addItem(allocation, 'CashReserve', item(cents(40_000), accountDestination()))
    expect(unallocatedPercent(allocation)).toBeCloseTo(60)
  })
})

describe('canSave — files_design/03, "soma dos itens não pode exceder o lucro líquido"', () => {
  it('allows saving with a leftover — a Pendência, never a validation failure', () => {
    let allocation = emptyAllocation(MONTH, cents(100_000))
    allocation = addItem(allocation, 'CashReserve', item(cents(10_000), accountDestination()))
    expect(canSave(allocation)).toBe(true)
  })

  it('allows saving exactly at the net profit', () => {
    let allocation = emptyAllocation(MONTH, cents(100_000))
    allocation = addItem(allocation, 'CashReserve', item(cents(100_000), accountDestination()))
    expect(canSave(allocation)).toBe(true)
  })

  /**
   * Every other assertion on `canSave` expects `true`, so replacing the whole
   * body with `return true` used to keep the suite green — the ONE rule that
   * blocks "Salvar Destinação" was never proved to block anything. The
   * over-limit allocation has to be built as a literal because `addItem`
   * refuses it first; that refusal is a second gate, not this one.
   */
  it('refuses to save when the items exceed the net profit', () => {
    const allocation = {
      month: MONTH,
      netProfit: cents(100_000),
      items: {
        ...EMPTY_ALLOCATION_ITEMS,
        CashReserve: [item(cents(100_001), accountDestination())],
      },
    }
    expect(canSave(allocation)).toBe(false)
  })

  /** A loss blocks by arithmetic alone: zero already exceeds a negative profit. */
  it('refuses to save against a prejuízo, even with nothing allocated', () => {
    expect(canSave(emptyAllocation(MONTH, cents(-5_000)))).toBe(false)
  })
})

describe('canAddItem', () => {
  it('allows an amount that fits inside what is left', () => {
    const allocation = emptyAllocation(MONTH, cents(10_000))
    expect(canAddItem(allocation, cents(10_000))).toBe(true)
  })

  it('refuses an amount bigger than what is left', () => {
    const allocation = emptyAllocation(MONTH, cents(10_000))
    expect(canAddItem(allocation, cents(10_001))).toBe(false)
  })

  it('refuses a negative amount', () => {
    const allocation = emptyAllocation(MONTH, cents(10_000))
    expect(canAddItem(allocation, cents(-1) as Cents)).toBe(false)
  })

  it('refuses anything at all when there is no profit to allocate', () => {
    const allocation = emptyAllocation(MONTH, ZERO)
    expect(canAddItem(allocation, ZERO)).toBe(false)
  })
})

describe('isDestinationValidForBucket — files_design/03 "Objeto Item de Destinação"', () => {
  it('accepts an Investment destination in the two investment cards', () => {
    expect(isDestinationValidForBucket('InvestmentContribution', investmentDestination())).toBe(
      true,
    )
    expect(isDestinationValidForBucket('DividendReinvestment', investmentDestination())).toBe(true)
  })

  it('accepts a BankAccount destination only in Reserva em Caixa', () => {
    expect(isDestinationValidForBucket('CashReserve', accountDestination())).toBe(true)
    expect(isDestinationValidForBucket('InvestmentContribution', accountDestination())).toBe(false)
  })

  it('accepts free text only in Consumo Extraordinário', () => {
    const freeText: AllocationDestination = { kind: 'FreeText', name: 'Viagem' }
    expect(isDestinationValidForBucket('ExtraordinaryConsumption', freeText)).toBe(true)
    expect(isDestinationValidForBucket('CashReserve', freeText)).toBe(false)
  })
})

describe('addItem — "+ Adicionar" (files_design/01 §9)', () => {
  it('appends an item to the named card only', () => {
    let allocation = emptyAllocation(MONTH, cents(50_000))
    allocation = addItem(allocation, 'CashReserve', item(cents(10_000), accountDestination()))
    expect(allocation.items.CashReserve).toHaveLength(1)
    expect(allocation.items.InvestmentContribution).toHaveLength(0)
  })

  it('refuses a mismatched destination — the screen never renders the wrong field', () => {
    const allocation = emptyAllocation(MONTH, cents(50_000))
    expect(() =>
      addItem(allocation, 'CashReserve', item(cents(1_000), investmentDestination())),
    ).toThrow('profit_allocation.destination_does_not_match_bucket')
  })

  it('refuses a negative amount', () => {
    const allocation = emptyAllocation(MONTH, cents(50_000))
    expect(() => addItem(allocation, 'CashReserve', item(cents(-1) as Cents))).toThrow(
      'profit_allocation.negative_amount',
    )
  })

  it('refuses an item that would exceed the net profit', () => {
    const allocation = emptyAllocation(MONTH, cents(10_000))
    expect(() =>
      addItem(allocation, 'CashReserve', item(cents(10_001), accountDestination())),
    ).toThrow('profit_allocation.exceeds_net_profit')
  })

  it('refuses any item at all when there is no profit to allocate', () => {
    const allocation = emptyAllocation(MONTH, ZERO)
    expect(() => addItem(allocation, 'CashReserve', item(ZERO))).toThrow(
      'profit_allocation.no_profit_to_allocate',
    )
  })

  it('an incomplete item (no destination) is allowed — that is what creates the Pendência', () => {
    const allocation = emptyAllocation(MONTH, cents(10_000))
    const next = addItem(allocation, 'CashReserve', item(cents(5_000), null))
    expect(next.items.CashReserve).toEqual([{ destination: null, amount: 5_000 }])
  })
})

describe('removeItem — "Remover" one item by position', () => {
  it('removes the item at the given index', () => {
    let allocation = emptyAllocation(MONTH, cents(50_000))
    allocation = addItem(allocation, 'CashReserve', item(cents(10_000), accountDestination()))
    allocation = addItem(allocation, 'CashReserve', item(cents(5_000), accountDestination()))

    const next = removeItem(allocation, 'CashReserve', 0)
    expect(next.items.CashReserve).toEqual([{ destination: accountDestination(), amount: 5_000 }])
  })

  it('refuses an out-of-range index', () => {
    const allocation = emptyAllocation(MONTH, cents(50_000))
    expect(() => removeItem(allocation, 'CashReserve', 0)).toThrow(
      'profit_allocation.item_not_found',
    )
    expect(() => removeItem(allocation, 'CashReserve', -1)).toThrow(
      'profit_allocation.item_not_found',
    )
  })
})

describe('pendingItemFor — "Saldo não alocado da Destinação do Lucro" (PRD §1, seção 9)', () => {
  it('is null when everything was allocated', () => {
    let allocation = emptyAllocation(MONTH, cents(10_000))
    allocation = addItem(allocation, 'CashReserve', item(cents(10_000), accountDestination()))
    expect(pendingItemFor(allocation)).toBeNull()
  })

  it('is null when there is no profit to allocate at all', () => {
    expect(pendingItemFor(emptyAllocation(MONTH, ZERO))).toBeNull()
  })

  it('carries the leftover amount and the month when something was left over', () => {
    let allocation = emptyAllocation(MONTH, cents(10_000))
    allocation = addItem(allocation, 'CashReserve', item(cents(4_000), accountDestination()))
    expect(pendingItemFor(allocation)).toEqual({
      kind: 'UnallocatedProfit',
      month: MONTH,
      amount: 6_000,
    })
  })
})

/* ---------------------------------------------------------------------------
 * Inversion checks — see docs/PERGUNTAS-EM-ABERTO.md convention and CLAUDE.md
 * "teste que pode falhar": each rule below was inverted, confirmed red, then
 * restored, to prove the assertion actually exercises the branch it claims to.
 * ------------------------------------------------------------------------ */

describe('inversion checks (documented in tests.inversions_verified)', () => {
  it('canSave really is <=, not <: exactly-at-the-limit must be allowed to save', () => {
    // Inverting `canSave` to strict `<` turns this red (it starts failing the
    // instant the sum equals the profit), which is the whole point of the
    // "exactly at the net profit" case above.
    let allocation = emptyAllocation(MONTH, cents(100_000))
    allocation = addItem(allocation, 'CashReserve', item(cents(100_000), accountDestination()))
    expect(canSave(allocation)).toBe(true)
  })

  it('unallocatedBalance really subtracts allocatedTotal, not just netProfit', () => {
    // Inverting the subtraction to return `allocation.netProfit` unchanged
    // turns this red: with an item present the two values must differ.
    let allocation = emptyAllocation(MONTH, cents(10_000))
    allocation = addItem(allocation, 'CashReserve', item(cents(4_000), accountDestination()))
    expect(unallocatedBalance(allocation)).not.toBe(allocation.netProfit)
    expect(unallocatedBalance(allocation)).toBe(6_000)
  })
})
