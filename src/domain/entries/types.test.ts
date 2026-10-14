import { describe, expect, it } from 'vitest'

import {
  asId,
  fromReais,
  isoDate,
  type BankAccountId,
  type CategoryId,
  type EntryId,
} from '@/domain/core'

import {
  isCategorized,
  isExpense,
  isIncomeTax,
  isProLabore,
  isProfitDistribution,
  isRevenue,
  type Entry,
  type ExpenseEntry,
  type IncomeTaxEntry,
  type NewEntry,
  type ProLaboreEntry,
} from './types'

const account = asId<BankAccountId>('nubank')
const pjAccount = asId<BankAccountId>('itau-pj')

const expense: ExpenseEntry = {
  id: asId<EntryId>('e1'),
  kind: 'Expense',
  amount: fromReais(1500),
  date: isoDate('2026-07-20'),
  status: 'Paid',
  recurrenceId: null,
  entity: 'PF',
  categoryId: asId<CategoryId>('aluguel-moradia'),
  classification: 'Current',
  bankAccountId: account,
}

const proLabore: ProLaboreEntry = {
  id: asId<EntryId>('e2'),
  kind: 'ProLabore',
  amount: fromReais(4000),
  date: isoDate('2026-07-05'),
  status: 'Paid',
  recurrenceId: null,
  sourceAccountId: pjAccount,
  destinationAccountId: account,
}

const incomeTax: IncomeTaxEntry = {
  id: asId<EntryId>('e3'),
  kind: 'IncomeTax',
  amount: fromReais(2680),
  date: isoDate('2026-07-31'),
  status: 'Planned',
  recurrenceId: null,
  direction: 'Payment',
  entity: 'PJ',
  bankAccountId: pjAccount,
  label: 'IR referente a 2025',
}

describe('entry type guards', () => {
  it('recognises each kind and only that kind', () => {
    expect(isExpense(expense)).toBe(true)
    expect(isRevenue(expense)).toBe(false)
    expect(isProLabore(proLabore)).toBe(true)
    expect(isProfitDistribution(proLabore)).toBe(false)
    expect(isIncomeTax(incomeTax)).toBe(true)
    expect(isExpense(incomeTax)).toBe(false)
  })

  it('narrows to the fields of the variant', () => {
    const entries: Entry[] = [expense, proLabore, incomeTax]
    const categories = entries.filter(isCategorized).map((entry) => entry.categoryId)
    const transfers = entries.filter(isProLabore).map((entry) => entry.destinationAccountId)
    const labels = entries.filter(isIncomeTax).map((entry) => entry.label)

    expect(categories).toEqual([expense.categoryId])
    expect(transfers).toEqual([account])
    expect(labels).toEqual(['IR referente a 2025'])
  })
})

describe('NewEntry', () => {
  it('drops the id while keeping each variant intact', () => {
    const draft: NewEntry = {
      kind: 'ProLabore',
      amount: fromReais(4000),
      date: isoDate('2026-08-05'),
      status: 'Planned',
      recurrenceId: null,
      sourceAccountId: pjAccount,
      destinationAccountId: account,
    }

    expect('id' in draft).toBe(false)
    expect(draft.kind === 'ProLabore' && draft.destinationAccountId).toBe(account)
  })
})
