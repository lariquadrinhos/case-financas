import { describe, expect, it } from 'vitest'
import { asId, cents, isoDate, ZERO } from '@/domain/core'
import type {
  BankAccountId,
  Cents,
  InstallmentId,
  InvestmentId,
  LiabilityId,
  TangibleAssetId,
} from '@/domain/core'
import type {
  BankAccount,
  Installment,
  Investment,
  Liability,
  TangibleAsset,
} from '@/domain/assets'
import { computeBalanceSheet, EMPTY_BALANCE_SHEET_GROUP } from './balance-sheet'
import type { BalanceSheetInput } from './balance-sheet'

const AS_OF = isoDate('2026-07-20')

function bankAccount(partial: Partial<BankAccount> & Pick<BankAccount, 'id'>): BankAccount {
  return {
    label: 'Conta',
    colour: 'nubank',
    entity: 'PF',
    balance: ZERO,
    ...partial,
  }
}

function investment(partial: Partial<Investment> & Pick<Investment, 'id'>): Investment {
  return { name: 'Investimento', entity: 'PF', accumulatedValue: ZERO, ...partial }
}

function tangibleAsset(partial: Partial<TangibleAsset> & Pick<TangibleAsset, 'id'>): TangibleAsset {
  return { name: 'Bem', entity: 'PF', recordedValue: ZERO, soldOn: null, ...partial }
}

function liability(partial: Partial<Liability> & Pick<Liability, 'id'>): Liability {
  return {
    name: 'Financiamento',
    creditor: 'Banco',
    entity: 'PF',
    classification: 'NonCurrent',
    originalAmount: cents(0),
    installmentAmount: cents(0),
    installmentCount: 1,
    installmentsAlreadyPaid: 0,
    monthlyInterestRate: 0,
    startDate: isoDate('2026-01-10'),
    ...partial,
  }
}

function installment(
  liabilityId: LiabilityId,
  partial: Partial<Installment> & Pick<Installment, 'id' | 'number' | 'plannedAmount'>,
): Installment {
  return {
    liabilityId,
    plannedDate: isoDate('2026-08-10'),
    status: 'Planned',
    paidAmount: null,
    paidDate: null,
    discarded: false,
    ...partial,
  }
}

function baseInput(overrides: Partial<BalanceSheetInput> = {}): BalanceSheetInput {
  return {
    asOf: AS_OF,
    view: 'Consolidated',
    bankAccounts: [],
    investments: [],
    tangibleAssets: [],
    liabilities: [],
    installmentsByLiability: new Map(),
    ...overrides,
  }
}

/* ------------------------------------------------- files_design/01 §8.2 */

describe('computeBalanceSheet — the four groups', () => {
  it('puts bank accounts in Ativo Circulante', () => {
    const account = bankAccount({ id: asId<BankAccountId>('a1'), balance: cents(500_000) })
    const sheet = computeBalanceSheet(baseInput({ bankAccounts: [account] }))
    expect(sheet.currentAssets.total).toBe(500_000)
    expect(sheet.currentAssets.items).toEqual([
      {
        source: { kind: 'BankAccount', bankAccountId: account.id },
        label: 'Conta',
        entity: 'PF',
        amount: 500_000,
      },
    ])
  })

  it('puts investments and unsold tangible assets in Ativo Não Circulante', () => {
    const inv = investment({ id: asId<InvestmentId>('i1'), accumulatedValue: cents(1_000_000) })
    const asset = tangibleAsset({ id: asId<TangibleAssetId>('t1'), recordedValue: cents(300_000) })
    const sheet = computeBalanceSheet(baseInput({ investments: [inv], tangibleAssets: [asset] }))
    expect(sheet.nonCurrentAssets.total).toBe(1_300_000)
    expect(sheet.nonCurrentAssets.items).toHaveLength(2)
  })

  it('splits liabilities into current and non-current by classification', () => {
    const current = liability({ id: asId<LiabilityId>('l1'), classification: 'Current' })
    const nonCurrent = liability({ id: asId<LiabilityId>('l2'), classification: 'NonCurrent' })
    const installments = new Map([
      [
        current.id,
        [
          installment(current.id, {
            id: asId<InstallmentId>('p1'),
            number: 1,
            plannedAmount: cents(10_000),
          }),
        ],
      ],
      [
        nonCurrent.id,
        [
          installment(nonCurrent.id, {
            id: asId<InstallmentId>('p2'),
            number: 1,
            plannedAmount: cents(90_000),
          }),
        ],
      ],
    ])
    const sheet = computeBalanceSheet(
      baseInput({ liabilities: [current, nonCurrent], installmentsByLiability: installments }),
    )
    expect(sheet.currentLiabilities.total).toBe(10_000)
    expect(sheet.nonCurrentLiabilities.total).toBe(90_000)
    expect(sheet.totalLiabilities).toBe(100_000)
  })

  it('computes Patrimônio Líquido as total assets minus total liabilities, even when negative', () => {
    const account = bankAccount({ id: asId<BankAccountId>('a1'), balance: cents(100_000) })
    const debt = liability({ id: asId<LiabilityId>('l1') })
    const installments = new Map([
      [
        debt.id,
        [
          installment(debt.id, {
            id: asId<InstallmentId>('p1'),
            number: 1,
            plannedAmount: cents(900_000),
          }),
        ],
      ],
    ])
    const sheet = computeBalanceSheet(
      baseInput({
        bankAccounts: [account],
        liabilities: [debt],
        installmentsByLiability: installments,
      }),
    )
    // 100.000 (ativo) - 900.000 (passivo) = -800.000, shown as-is, never clamped.
    expect(sheet.netWorth).toBe(-800_000)
  })
})

/* -------------------------------------------------------- files_design/01 §11 */

describe('computeBalanceSheet — a sold tangible asset already left the patrimônio', () => {
  it('excludes an asset with soldOn set, even though it is still in the table', () => {
    const sold = tangibleAsset({
      id: asId<TangibleAssetId>('t1'),
      recordedValue: cents(300_000),
      soldOn: isoDate('2026-06-01'),
    })
    const unsold = tangibleAsset({ id: asId<TangibleAssetId>('t2'), recordedValue: cents(50_000) })
    const sheet = computeBalanceSheet(baseInput({ tangibleAssets: [sold, unsold] }))
    expect(sheet.nonCurrentAssets.total).toBe(50_000)
    expect(sheet.nonCurrentAssets.items).toHaveLength(1)
  })
})

/* ---------------------------------------------------- ADR-0003 — 3 visões */

describe('computeBalanceSheet — the view filters every group by entity', () => {
  const pfAccount = bankAccount({
    id: asId<BankAccountId>('a-pf'),
    entity: 'PF',
    balance: cents(200_000),
  })
  const pjAccount = bankAccount({
    id: asId<BankAccountId>('a-pj'),
    entity: 'PJ',
    balance: cents(800_000),
  })

  it('Consolidado sees both entities', () => {
    const sheet = computeBalanceSheet(baseInput({ bankAccounts: [pfAccount, pjAccount] }))
    expect(sheet.currentAssets.total).toBe(1_000_000)
  })

  it('PF sees only its own accounts', () => {
    const sheet = computeBalanceSheet(
      baseInput({ view: 'PF', bankAccounts: [pfAccount, pjAccount] }),
    )
    expect(sheet.currentAssets.total).toBe(200_000)
    expect(sheet.currentAssets.items).toEqual([
      {
        source: { kind: 'BankAccount', bankAccountId: pfAccount.id },
        label: 'Conta',
        entity: 'PF',
        amount: 200_000,
      },
    ])
  })

  it('PJ sees only its own accounts', () => {
    const sheet = computeBalanceSheet(
      baseInput({ view: 'PJ', bankAccounts: [pfAccount, pjAccount] }),
    )
    expect(sheet.currentAssets.total).toBe(800_000)
  })
})

/* ------------------------------------------------------------- degenerate */

describe('computeBalanceSheet — an account new to the product', () => {
  it('every group is empty and every total is zero, never thrown', () => {
    const sheet = computeBalanceSheet(baseInput())
    expect(sheet.currentAssets).toEqual(EMPTY_BALANCE_SHEET_GROUP)
    expect(sheet.nonCurrentAssets).toEqual(EMPTY_BALANCE_SHEET_GROUP)
    expect(sheet.currentLiabilities).toEqual(EMPTY_BALANCE_SHEET_GROUP)
    expect(sheet.nonCurrentLiabilities).toEqual(EMPTY_BALANCE_SHEET_GROUP)
    expect(sheet.totalAssets).toBe(ZERO)
    expect(sheet.totalLiabilities).toBe(ZERO)
    expect(sheet.netWorth).toBe(ZERO)
  })

  it('treats a liability with no schedule in the map as fully outstanding at zero', () => {
    // installmentsByLiability.get(id) misses entirely — the header comment of
    // balance-sheet.ts promises this is never thrown for.
    const debt = liability({ id: asId<LiabilityId>('l1') })
    const sheet = computeBalanceSheet(baseInput({ liabilities: [debt] }))
    expect(sheet.nonCurrentLiabilities.total).toBe(ZERO)
    expect(sheet.nonCurrentLiabilities.items).toEqual([
      {
        source: { kind: 'Liability', liabilityId: debt.id },
        label: 'Financiamento',
        entity: 'PF',
        amount: ZERO,
      },
    ])
  })
})

describe('computeBalanceSheet — the outstanding balance of a liability, not the original amount', () => {
  it('Figma 91:2 nó 91:50 — desconta as parcelas ainda Previstas à taxa do passivo, não soma o nominal', () => {
    // Mesma grandeza do card "Informações da Dívida" e da coluna "Saldo devedor"
    // da lista (Figma `40:2` nó `90:67`): principal em aberto. A soma nominal
    // das duas Previstas daria 189.000; descontadas a 0,85% a.m. dão 186.621.
    const debt = liability({
      id: asId<LiabilityId>('l1'),
      originalAmount: cents(1_000_000),
      classification: 'NonCurrent',
      monthlyInterestRate: 0.0085,
    })
    const installments: Installment[] = [
      installment(debt.id, {
        id: asId<InstallmentId>('p1'),
        number: 1,
        plannedAmount: cents(100_000),
        status: 'Paid',
        paidAmount: cents(100_000),
      }),
      installment(debt.id, {
        id: asId<InstallmentId>('p2'),
        number: 2,
        plannedAmount: cents(95_000),
      }),
      installment(debt.id, {
        id: asId<InstallmentId>('p3'),
        number: 3,
        plannedAmount: cents(94_000),
      }),
    ]
    const sheet = computeBalanceSheet(
      baseInput({
        liabilities: [debt],
        installmentsByLiability: new Map([[debt.id, installments]]),
      }),
    )
    expect(sheet.nonCurrentLiabilities.items[0]?.amount).toBe(186_621)
  })

  it('a 0% a.m. o principal em aberto É a soma das parcelas Previstas — não há juros a descontar', () => {
    const debt = liability({
      id: asId<LiabilityId>('l1'),
      originalAmount: cents(1_000_000),
      classification: 'NonCurrent',
    })
    const installments: Installment[] = [
      installment(debt.id, {
        id: asId<InstallmentId>('p1'),
        number: 1,
        plannedAmount: cents(100_000),
        status: 'Paid',
        paidAmount: cents(100_000),
      }),
      installment(debt.id, {
        id: asId<InstallmentId>('p2'),
        number: 2,
        plannedAmount: cents(95_000),
      }),
      installment(debt.id, {
        id: asId<InstallmentId>('p3'),
        number: 3,
        plannedAmount: cents(94_000),
      }),
    ]
    const sheet = computeBalanceSheet(
      baseInput({
        liabilities: [debt],
        installmentsByLiability: new Map([[debt.id, installments]]),
      }),
    )
    // Not the original amount (1.000.000), not the paid one (100.000): the two
    // still-Planned instalments only.
    const amount: Cents = sheet.nonCurrentLiabilities.items[0]?.amount as Cents
    expect(amount).toBe(189_000)
  })
})

describe('computeBalanceSheet — a photo, never a series', () => {
  it('carries the day it was taken as asOf, verbatim', () => {
    const sheet = computeBalanceSheet(baseInput({ asOf: isoDate('2026-03-01') }))
    expect(sheet.asOf).toBe('2026-03-01')
  })
})
