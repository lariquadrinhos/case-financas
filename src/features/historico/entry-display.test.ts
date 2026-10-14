import { describe, expect, it } from 'vitest'
import { cents } from '@/domain/core'
import { entryDisplayName, entrySignedAmount, formatSignedMoney } from './entry-display'
import type { Category, Entry } from './types'

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    blockId: 'block-1',
    name: 'Aluguel',
    isSystem: false,
    suggestedClassification: null,
    archived: false,
    isPassiveIncome: false,
    ...overrides,
  }
}

function expenseEntry(overrides: Partial<Extract<Entry, { kind: 'Expense' }>> = {}): Entry {
  return {
    kind: 'Expense',
    id: 'e1',
    amount: 1000,
    date: '2026-08-31',
    status: 'Paid',
    recurrenceId: null,
    entity: 'PF',
    categoryId: 'cat-1',
    classification: 'Current',
    bankAccountId: 'acc-1',
    ...overrides,
  }
}

function revenueEntry(overrides: Partial<Extract<Entry, { kind: 'Revenue' }>> = {}): Entry {
  return {
    kind: 'Revenue',
    id: 'e1',
    amount: 1000,
    date: '2026-08-31',
    status: 'Paid',
    recurrenceId: null,
    entity: 'PF',
    categoryId: 'cat-1',
    classification: 'Current',
    bankAccountId: 'acc-1',
    ...overrides,
  }
}

function incomeTaxEntry(overrides: Partial<Extract<Entry, { kind: 'IncomeTax' }>> = {}): Entry {
  return {
    kind: 'IncomeTax',
    id: 'e2',
    amount: 500,
    date: '2026-08-31',
    status: 'Paid',
    recurrenceId: null,
    direction: 'Payment',
    entity: 'PJ',
    bankAccountId: 'acc-1',
    label: null,
    ...overrides,
  }
}

describe('entrySignedAmount — PRD/domain: IR muda de sinal pela direção, igual à projeção do DRE', () => {
  // src/domain/entries/projection.ts `effectInView`'s IncomeTax branch: a
  // `Refund` gives money back (positive in Histórico), a `Payment` takes it
  // (negative) — the two directions MUST be opposite signs, or the
  // Histórico's amount column would tell the person a IR refund left their
  // account.
  it('IR de direção Payment sai negativo', () => {
    expect(entrySignedAmount(incomeTaxEntry({ direction: 'Payment', amount: 700 }))).toBe(-700)
  })

  it('IR de direção Refund entra positivo', () => {
    expect(entrySignedAmount(incomeTaxEntry({ direction: 'Refund', amount: 700 }))).toBe(700)
  })

  it('Despesa é sempre negativa', () => {
    expect(entrySignedAmount(expenseEntry({ amount: 250 }))).toBe(-250)
  })

  it('Receita é sempre positiva', () => {
    expect(entrySignedAmount(revenueEntry({ amount: 250 }))).toBe(250)
  })
})

describe('formatSignedMoney — Figma 9:2: a coluna Valor do Histórico diz a direção pelo sinal', () => {
  // The Valor column mixes money leaving and money entering, so the frame
  // prints BOTH signs — `9:75` is "− R$ 184,90", `9:90` is "+ R$ 3.200,00".
  // Dropping either sign makes a receita and a despesa read identically.
  it('saída sai com − (menos tipográfico), nunca hífen ASCII', () => {
    expect(formatSignedMoney(cents(-18490))).toBe('\u2212\u00a0R$\u00a0184,90')
  })

  it('entrada sai com +', () => {
    expect(formatSignedMoney(cents(320000))).toBe('+\u00a0R$\u00a03.200,00')
  })

  it('zero não ganha sinal — não entrou nem saiu', () => {
    expect(formatSignedMoney(cents(0))).toBe('R$\u00a00,00')
  })
})

describe('entryDisplayName', () => {
  it('Despesa/Receita usam o nome da categoria (não têm Rótulo)', () => {
    const categoriesById = new Map([['cat-1', category({ name: 'Aluguel' })]])
    expect(entryDisplayName(expenseEntry({ categoryId: 'cat-1' }), categoriesById)).toBe('Aluguel')
  })

  it('IR usa o Rótulo quando informado, senão o nome fixo', () => {
    expect(entryDisplayName(incomeTaxEntry({ label: 'DARF Ago' }), new Map())).toBe('DARF Ago')
    expect(entryDisplayName(incomeTaxEntry({ label: null }), new Map())).toBe('Imposto de Renda')
  })
})
