/**
 * Balanço Patrimonial — a photo of the present moment (files_design/01 §8.2,
 * PRD "Plano de contas de referência" — Balanço Patrimonial).
 *
 * Like the DRE, this is a PROJECTION, never a source of truth: delete it,
 * recompute it, and the numbers are identical (docs/ARCHITECTURE.md §1). It
 * reads `BankAccount`, `Investment`, `TangibleAsset` and `Liability` straight
 * from `@/domain/assets` — allowed by the dependency rule in
 * src/domain/README.md ("reports ← entries + chart-of-accounts + assets").
 *
 * Two rules this file does NOT reimplement, on purpose:
 *   - the entity/view filter mirrors `isOutOfView` in
 *     `@/domain/entries/projection.ts`, but that function is private to the
 *     Entry union and this report has no Entry to project — a two-line local
 *     copy is cheaper than a cross-module dependency for one boolean;
 *   - the outstanding balance of a Liability is `@/domain/assets`'
 *     `outstandingBalance`, not re-derived here.
 */

import {
  type Cents,
  type Entity,
  type IsoDate,
  type LiabilityId,
  type View,
  ZERO,
  add,
  subtract,
} from '@/domain/core'
import type {
  BankAccount,
  Installment,
  Investment,
  Liability,
  TangibleAsset,
} from '@/domain/assets'
import { outstandingBalance } from '@/domain/assets'
import type { BalanceSheet, BalanceSheetGroup, BalanceSheetItem } from './types'

export interface BalanceSheetInput {
  /** "posição em 20/07/2026" — the day the photo is of, supplied by the caller (no clock here). */
  readonly asOf: IsoDate
  readonly view: View
  readonly bankAccounts: readonly BankAccount[]
  readonly investments: readonly Investment[]
  /**
   * ALL tangible assets, sold or not: this function filters out the sold ones
   * itself (a sold Bem Material already left the patrimony, files_design/01
   * §11), the same way `computeIncomeStatement` filters by month itself instead
   * of trusting the caller to pre-filter.
   */
  readonly tangibleAssets: readonly TangibleAsset[]
  readonly liabilities: readonly Liability[]
  /**
   * The installment schedule of each liability, keyed by its id. A liability
   * absent from the map is treated as fully outstanding at zero — never thrown
   * for — because `outstandingBalance([], …)` discounts an empty stream to zero.
   */
  readonly installmentsByLiability: ReadonlyMap<LiabilityId, readonly Installment[]>
}

/**
 * The consolidated view sees both entities; PF and PJ see only their own.
 * Mirrors `isOutOfView` in `@/domain/entries/projection.ts` — same rule,
 * inverted, applied to a plain `Entity` field instead of an `Entry`.
 */
function isInView(entity: Entity, view: View): boolean {
  return view === 'Consolidated' || view === entity
}

function group(items: readonly BalanceSheetItem[]): BalanceSheetGroup {
  return { total: add(...items.map((item) => item.amount)), items }
}

export function computeBalanceSheet(input: BalanceSheetInput): BalanceSheet {
  const {
    asOf,
    view,
    bankAccounts,
    investments,
    tangibleAssets,
    liabilities,
    installmentsByLiability,
  } = input

  const currentAssets = group(
    bankAccounts
      .filter((account) => isInView(account.entity, view))
      .map((account): BalanceSheetItem => ({
        source: { kind: 'BankAccount', bankAccountId: account.id },
        label: account.label,
        entity: account.entity,
        amount: account.balance,
      })),
  )

  const nonCurrentAssets = group([
    ...investments
      .filter((investment) => isInView(investment.entity, view))
      .map((investment): BalanceSheetItem => ({
        source: { kind: 'Investment', investmentId: investment.id },
        label: investment.name,
        entity: investment.entity,
        amount: investment.accumulatedValue,
      })),
    // "Sem cálculo automático de depreciação" (PRD §5): the asset is carried at
    // `recordedValue` until the day it is sold, never reappraised in between.
    ...tangibleAssets
      .filter((asset) => asset.soldOn === null && isInView(asset.entity, view))
      .map((asset): BalanceSheetItem => ({
        source: { kind: 'TangibleAsset', tangibleAssetId: asset.id },
        label: asset.name,
        entity: asset.entity,
        amount: asset.recordedValue,
      })),
  ])

  const liabilityItem = (liability: Liability): BalanceSheetItem => ({
    source: { kind: 'Liability', liabilityId: liability.id },
    label: liability.name,
    entity: liability.entity,
    // "Saldo devedor de financiamento" (PRD), not the original amount: the
    // principal still owed today — o MESMO número do card "Informações da
    // Dívida" (Figma `91:2` nó `91:50`) e da coluna "Saldo devedor" da lista
    // (Figma `40:2` nó `90:67`), por isso a taxa do passivo entra aqui.
    amount: outstandingBalance(
      installmentsByLiability.get(liability.id) ?? [],
      liability.monthlyInterestRate,
    ),
  })

  const inViewLiabilities = liabilities.filter((liability) => isInView(liability.entity, view))
  const currentLiabilities = group(
    inViewLiabilities.filter((l) => l.classification === 'Current').map(liabilityItem),
  )
  const nonCurrentLiabilities = group(
    inViewLiabilities.filter((l) => l.classification === 'NonCurrent').map(liabilityItem),
  )

  const totalAssets: Cents = add(currentAssets.total, nonCurrentAssets.total)
  const totalLiabilities: Cents = add(currentLiabilities.total, nonCurrentLiabilities.total)

  return {
    view,
    asOf,
    currentAssets,
    nonCurrentAssets,
    currentLiabilities,
    nonCurrentLiabilities,
    totalAssets,
    totalLiabilities,
    // "Patrimônio Líquido = Ativos − Passivos", shown even when negative, in
    // neutral style — never zero, never clamped (PRD, critérios de liberação).
    netWorth: subtract(totalAssets, totalLiabilities),
  }
}

// Re-exported so a caller building the input map does not need a second import
// just to produce an empty starting point.
export const EMPTY_BALANCE_SHEET_GROUP: BalanceSheetGroup = { total: ZERO, items: [] }
