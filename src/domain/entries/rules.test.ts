import { describe, expect, it } from 'vitest'
import { asId, cents, isoDate, month, ZERO } from '@/domain/core'
import type {
  BankAccountId,
  CategoryId,
  Cents,
  EntryId,
  IsoDate,
  RecurrenceId,
} from '@/domain/core'
import { effectInView } from './projection'
import {
  accountingMonth,
  applyEntryPatch,
  entersIncomeStatement,
  filterEntries,
  markAsPaid,
  visibleInView,
} from './rules'
import { isExpense } from './types'
import type { Entry, EntryFilter } from './types'

/* ---------------------------------------------------------------- fixtures */

const RENT_CATEGORY = asId<CategoryId>('aluguel-moradia')
const DIVIDEND_CATEGORY = asId<CategoryId>('dividendos-investimentos-externos')
const PF_ACCOUNT = asId<BankAccountId>('conta-pf')
const PJ_ACCOUNT = asId<BankAccountId>('conta-pj')

let sequence = 0
const nextId = () => asId<EntryId>(`entry-${(sequence += 1)}`)

function expense(over: Partial<Entry> & { amount: Cents } & Record<string, unknown>): Entry {
  return {
    id: nextId(),
    kind: 'Expense',
    entity: 'PF',
    date: isoDate('2026-07-15'),
    status: 'Paid',
    recurrenceId: null,
    categoryId: RENT_CATEGORY,
    classification: 'Current',
    bankAccountId: PF_ACCOUNT,
    ...over,
  } as Entry
}

function revenue(over: Partial<Entry> & { amount: Cents } & Record<string, unknown>): Entry {
  return { ...expense(over), kind: 'Revenue', ...over } as Entry
}

function proLabore(amount: Cents): Entry {
  return {
    id: nextId(),
    kind: 'ProLabore',
    amount,
    date: isoDate('2026-07-05'),
    status: 'Paid',
    recurrenceId: null,
    sourceAccountId: PJ_ACCOUNT,
    destinationAccountId: PF_ACCOUNT,
  }
}

function profitDistribution(amount: Cents): Entry {
  return {
    id: nextId(),
    kind: 'ProfitDistribution',
    amount,
    date: isoDate('2026-07-05'),
    status: 'Paid',
    recurrenceId: null,
    sourceAccountId: PJ_ACCOUNT,
    destinationAccountId: PF_ACCOUNT,
  }
}

function incomeTax(amount: Cents, direction: 'Payment' | 'Refund'): Entry {
  return {
    id: nextId(),
    kind: 'IncomeTax',
    amount,
    date: isoDate('2026-07-20'),
    status: 'Paid',
    recurrenceId: null,
    direction,
    entity: 'PF',
    bankAccountId: PF_ACCOUNT,
    label: 'IR 2026',
  }
}

const NO_FILTER: EntryFilter = {
  status: null,
  view: null,
  month: null,
  categoryId: null,
  classification: null,
  bankAccountId: null,
  recurring: null,
}

/* ------------------------------------------------ PRD §5 — regime de caixa */

describe('accountingMonth — PRD §5, the month is the payment date, nothing else', () => {
  it('puts a payment of 31 July in July and one of 1 August in August', () => {
    expect(accountingMonth(expense({ amount: cents(100), date: isoDate('2026-07-31') }))).toBe(
      '2026-07',
    )
    expect(accountingMonth(expense({ amount: cents(100), date: isoDate('2026-08-01') }))).toBe(
      '2026-08',
    )
  })

  it('moves the entry to another month when the payment date is corrected', () => {
    // The person planned in July and paid in August. The DRE must follow the
    // payment, not the plan.
    const planned = expense({ amount: cents(100), date: isoDate('2026-07-10'), status: 'Planned' })
    const { entry: paid } = markAsPaid(planned, cents(100), isoDate('2026-08-03'))
    expect(accountingMonth(planned)).toBe('2026-07')
    expect(accountingMonth(paid)).toBe('2026-08')
  })

  it('ADR-0021 — "Contabilizar em" manda no mês contábil da despesa, não a data de pagamento', () => {
    const cardPurchase = expense({
      amount: cents(100),
      date: isoDate('2026-10-15'),
      accountingMonth: month('2026-09'),
    })
    expect(accountingMonth(cardPurchase)).toBe('2026-09')
  })

  it('ADR-0021 — sem "Contabilizar em", continua valendo o mês do pagamento', () => {
    const plain = expense({
      amount: cents(100),
      date: isoDate('2026-10-15'),
      accountingMonth: null,
    })
    expect(accountingMonth(plain)).toBe('2026-10')
  })

  it('ADR-0021 — mudar a data de pagamento não arrasta um "Contabilizar em" escolhido', () => {
    const planned = expense({
      amount: cents(100),
      date: isoDate('2026-10-15'),
      status: 'Planned',
      accountingMonth: month('2026-09'),
    })
    const { entry: paid } = markAsPaid(planned, cents(100), isoDate('2026-11-02'))
    expect(accountingMonth(paid)).toBe('2026-09')
  })
})

describe('entersIncomeStatement — PRD §1, Previsto does not enter the DRE', () => {
  it('excludes a Planned entry under the Paid filter', () => {
    const planned = expense({ amount: cents(100), status: 'Planned' })
    expect(entersIncomeStatement(planned, 'Paid')).toBe(false)
  })

  it('includes a Planned entry under the Planned filter', () => {
    const planned = expense({ amount: cents(100), status: 'Planned' })
    expect(entersIncomeStatement(planned, 'Planned')).toBe(true)
  })

  it('dono 2026-10-09 — "Previsto" é a previsão completa: o Pago também entra', () => {
    // Era exclusivo (files_design/01 §8.1: "um OU outro"). O dono: "o filtro
    // Previsto deveria contabilizar o pago também", "quero minha previsão
    // completa". Pago continua só o realizado (PRD §1).
    const paid = expense({ amount: cents(100), status: 'Paid' })
    expect(entersIncomeStatement(paid, 'Planned')).toBe(true)
    expect(entersIncomeStatement(paid, 'Paid')).toBe(true)
  })
})

/* ------------------------------- PRD §1 / H2 — eliminação intercompany */

describe('effectInView — pró-labore across the three views (ADR-0003)', () => {
  const entry = proLabore(cents(400_000))

  it('PJ: is an operating expense and REDUCES the profit', () => {
    const effect = effectInView(entry, 'PJ')
    expect(effect.kind).toBe('Included')
    if (effect.kind !== 'Included') throw new Error('unreachable')
    expect(effect.role).toBe('OperatingExpense')
    expect(effect.contribution).toBe(-400_000)
  })

  it('PF: is revenue', () => {
    const effect = effectInView(entry, 'PF')
    expect(effect.kind).toBe('Included')
    if (effect.kind !== 'Included') throw new Error('unreachable')
    expect(effect.role).toBe('GrossRevenue')
    expect(effect.contribution).toBe(400_000)
  })

  it('Consolidated: is ELIMINATED, so the same money is not counted twice', () => {
    const effect = effectInView(entry, 'Consolidated')
    expect(effect).toEqual({ kind: 'Excluded', reason: 'IntercompanyElimination' })
  })
})

describe('effectInView — distribuição de lucro across the three views (ADR-0003)', () => {
  const entry = profitDistribution(cents(1_000_000))

  it('PJ: is an appropriation of profit, NOT an operating expense', () => {
    // This is the difference from pró-labore that the PRD spends a paragraph on.
    // If this role were OperatingExpense, the PJ's EBIT would be wrong by the
    // whole distributed amount.
    const effect = effectInView(entry, 'PJ')
    expect(effect.kind).toBe('Included')
    if (effect.kind !== 'Included') throw new Error('unreachable')
    expect(effect.role).toBe('ProfitAllocation')
    expect(effect.role).not.toBe('OperatingExpense')
  })

  it('PF: is revenue', () => {
    const effect = effectInView(entry, 'PF')
    expect(effect.kind).toBe('Included')
    if (effect.kind !== 'Included') throw new Error('unreachable')
    expect(effect.role).toBe('GrossRevenue')
  })

  it('Consolidated: is ELIMINATED', () => {
    expect(effectInView(entry, 'Consolidated')).toEqual({
      kind: 'Excluded',
      reason: 'IntercompanyElimination',
    })
  })
})

describe('effectInView — an external dividend is NOT intercompany (PRD §1, explicit warning)', () => {
  // The likeliest confusion in this domain: "dividend" sounds like money moving
  // between the person's own entities. It is not. A dividend from an external
  // investment is ordinary block-1 revenue and SURVIVES consolidation.
  const dividend = revenue({ amount: cents(250_000), categoryId: DIVIDEND_CATEGORY, entity: 'PF' })

  it('survives the consolidated view', () => {
    const effect = effectInView(dividend, 'Consolidated')
    expect(effect.kind).toBe('Included')
    if (effect.kind !== 'Included') throw new Error('unreachable')
    expect(effect.contribution).toBe(250_000)
  })

  it('is never excluded for the intercompany reason', () => {
    for (const view of ['Consolidated', 'PF', 'PJ'] as const) {
      const effect = effectInView(dividend, view)
      if (effect.kind === 'Excluded') {
        expect(effect.reason).toBe('OtherEntity')
      }
    }
  })
})

describe('effectInView — an ordinary entry belongs to its entity and to the consolidated view', () => {
  const pfExpense = expense({ amount: cents(150_000), entity: 'PF' })

  it('appears in PF and in Consolidated, and not in PJ', () => {
    expect(visibleInView(pfExpense, 'PF')).toBe(true)
    expect(visibleInView(pfExpense, 'Consolidated')).toBe(true)
    expect(visibleInView(pfExpense, 'PJ')).toBe(false)
    expect(effectInView(pfExpense, 'PJ')).toEqual({ kind: 'Excluded', reason: 'OtherEntity' })
  })

  it('an expense reduces the profit and a revenue increases it', () => {
    const income = revenue({ amount: cents(150_000), entity: 'PF' })
    const expenseEffect = effectInView(pfExpense, 'PF')
    const revenueEffect = effectInView(income, 'PF')
    if (expenseEffect.kind !== 'Included' || revenueEffect.kind !== 'Included') {
      throw new Error('unreachable')
    }
    expect(expenseEffect.contribution).toBe(-150_000)
    expect(revenueEffect.contribution).toBe(150_000)
  })
})

describe('effectInView — IR (PRD §5, "pagamento ou recebimento")', () => {
  it('a payment takes profit away', () => {
    const effect = effectInView(incomeTax(cents(80_000), 'Payment'), 'PF')
    if (effect.kind !== 'Included') throw new Error('unreachable')
    expect(effect.role).toBe('ProfitTaxes')
    expect(effect.contribution).toBe(-80_000)
  })

  it('a refund gives profit back, rather than becoming revenue', () => {
    const effect = effectInView(incomeTax(cents(80_000), 'Refund'), 'PF')
    if (effect.kind !== 'Included') throw new Error('unreachable')
    expect(effect.role).toBe('ProfitTaxes')
    expect(effect.contribution).toBe(80_000)
  })
})

/* ------------------------------------------------------ files_design/01 §7 */

describe('filterEntries — the seven Histórico filters', () => {
  const entries: Entry[] = [
    expense({ amount: cents(100), entity: 'PF', status: 'Paid', date: isoDate('2026-07-10') }),
    expense({ amount: cents(200), entity: 'PJ', status: 'Planned', date: isoDate('2026-07-11') }),
    expense({
      amount: cents(300),
      entity: 'PF',
      status: 'Paid',
      date: isoDate('2026-08-01'),
      recurrenceId: asId<RecurrenceId>('rec-1'),
    }),
    proLabore(cents(400)),
  ]

  it('applies no filter when every field is null', () => {
    expect(filterEntries(entries, NO_FILTER)).toHaveLength(4)
  })

  it('filters by status', () => {
    expect(filterEntries(entries, { ...NO_FILTER, status: 'Planned' })).toHaveLength(1)
  })

  it('filters by accounting month, using the payment date', () => {
    expect(filterEntries(entries, { ...NO_FILTER, month: month('2026-08') })).toHaveLength(1)
  })

  it('filters by recurrence', () => {
    expect(filterEntries(entries, { ...NO_FILTER, recurring: true })).toHaveLength(1)
    expect(filterEntries(entries, { ...NO_FILTER, recurring: false })).toHaveLength(3)
  })

  it('hides the pró-labore under the Consolidated view, like the DRE does', () => {
    // The Histórico and the DRE must agree. If this ever diverged, the person
    // would see an entry in the list that the report says does not exist.
    const consolidated = filterEntries(entries, { ...NO_FILTER, view: 'Consolidated' })
    expect(consolidated.some((e) => e.kind === 'ProLabore')).toBe(false)
    expect(consolidated).toHaveLength(3)
  })

  it('excludes entries that do not carry the filtered field, instead of letting them pass', () => {
    // A pró-labore has no Categoria. Filtering by category must drop it, not
    // keep it because the field is absent.
    const byCategory = filterEntries(entries, { ...NO_FILTER, categoryId: RENT_CATEGORY })
    expect(byCategory.some((e) => e.kind === 'ProLabore')).toBe(false)
  })

  it('matches a pró-labore on either of its two accounts', () => {
    expect(filterEntries(entries, { ...NO_FILTER, bankAccountId: PJ_ACCOUNT })).toHaveLength(1)
  })
})

/* --------------------------------------- files_design/03 — "Marcar Pago" */

describe('markAsPaid — the two behaviours differ by the SIGN of the difference', () => {
  const planned = expense({
    amount: cents(150_000),
    status: 'Planned',
    date: isoDate('2026-07-10'),
  })

  it('an exact payment produces no discrepancy', () => {
    const { entry, outcome } = markAsPaid(planned, cents(150_000), isoDate('2026-07-12'))
    expect(outcome).toEqual({ kind: 'Exact' })
    expect(entry.status).toBe('Paid')
    expect(entry.date).toBe('2026-07-12')
  })

  it('paying LESS than planned leaves a shortfall that becomes a pending item', () => {
    const { outcome } = markAsPaid(planned, cents(130_000), isoDate('2026-07-12'))
    expect(outcome).toEqual({ kind: 'Underpaid', shortfall: 20_000, becomesPending: true })
  })

  it('paying MORE than planned NEVER becomes a pending item', () => {
    // The rule the two cases are most often collapsed into one: an overpayment
    // is a choice offered to the person, not a debt the app tracks.
    const { outcome } = markAsPaid(planned, cents(154_000), isoDate('2026-07-12'))
    expect(outcome).toEqual({ kind: 'Overpaid', excess: 4_000, becomesPending: false })
    if (outcome.kind !== 'Overpaid') throw new Error('unreachable')
    expect(outcome.becomesPending).toBe(false)
  })

  it('records the amount actually paid, not the planned one', () => {
    const { entry } = markAsPaid(planned, cents(130_000), isoDate('2026-07-12'))
    expect(entry.amount).toBe(130_000)
  })

  it('rejects a negative paid amount', () => {
    expect(() => markAsPaid(planned, cents(-1) as Cents, isoDate('2026-07-12'))).toThrow(
      'entries.negative_paid_amount',
    )
  })

  it('accepts a zero payment, which is a full shortfall', () => {
    const { outcome } = markAsPaid(planned, ZERO, isoDate('2026-07-12') as IsoDate)
    expect(outcome).toEqual({ kind: 'Underpaid', shortfall: 150_000, becomesPending: true })
  })
})

describe('applyEntryPatch — "Editar" on the Histórico / DRE row', () => {
  const stored = expense({ amount: cents(1500), categoryId: RENT_CATEGORY })

  it('merges the patched fields onto the stored entry', () => {
    const patched = applyEntryPatch(stored, { kind: 'Expense', amount: cents(1800) })
    expect(patched.amount).toBe(1800)
    if (!isExpense(patched)) throw new Error('unreachable')
    // Everything not in the patch survives untouched.
    expect(patched.categoryId).toBe(RENT_CATEGORY)
    expect(patched.id).toBe(stored.id)
  })

  it('src/api/contracts/entries.ts — refuses a patch that changes the natureza of the entry', () => {
    // A Despesa becoming a Pró-labore is a different transaction, not an edit.
    expect(() => applyEntryPatch(stored, { kind: 'ProLabore' } as never)).toThrow(
      'entries.patch_changes_kind',
    )
  })

  // Pedido de produto, 2026-09-23: trocar o Sub-tipo no Editar dava 409. Os
  // dois têm os mesmos campos (files_design/03, "Aba Pró-labore e
  // Distribuição"): trocar é corrigir o que foi digitado, não outra transação.
  it('2026-09-23 — Pró-labore ↔ Distribuição de lucro é troca de Sub-tipo, e é permitida', () => {
    const stored = proLabore(cents(2_300_000))
    const patched = applyEntryPatch(stored, { kind: 'ProfitDistribution' } as never)

    expect(patched.kind).toBe('ProfitDistribution')
    expect(patched.amount).toBe(2_300_000)
    expect(applyEntryPatch(patched, { kind: 'ProLabore' } as never).kind).toBe('ProLabore')
  })

  it('a troca de Sub-tipo não abre porta para outra natureza', () => {
    expect(() => applyEntryPatch(proLabore(cents(100)), { kind: 'Expense' } as never)).toThrow(
      'entries.patch_changes_kind',
    )
  })

  it('leaves the stored entry itself untouched (no mutation)', () => {
    const before = { ...stored }
    applyEntryPatch(stored, { kind: 'Expense', amount: cents(9_999) })
    expect(stored).toEqual(before)
  })
})
