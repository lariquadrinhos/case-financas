/**
 * "Caixa do mês" — the cash the person has today and what is left of the month
 * (owner, 2026-10-09: "o DRE não está contabilizando meu saldo em conta
 * atual"). It sits BESIDE the cascade, never inside it: the DRE is the result
 * of the month and the balance is patrimony, two separate planes (PRD §5).
 * Folding the balance into the cascade would stop the last line being a profit.
 *
 * What was already paid is in today's balance; only what is still Previsto
 * moves it until the end of the month.
 */

import {
  type BankAccountId,
  type Cents,
  type Entity,
  type View,
  add,
  cents,
  subtract,
  ZERO,
} from '@/domain/core'
import type { IncomeStatementRow } from './types'

export interface CashAccount {
  readonly id: BankAccountId
  readonly label: string
  readonly entity: Entity
  readonly balance: Cents
}

export interface CashForecast {
  readonly accounts: readonly (CashAccount & { readonly hidden: boolean })[]
  readonly balanceToday: Cents
  /** Entradas − saídas still Previsto in the month, in the same view. */
  readonly stillPlanned: Cents
  readonly endOfMonth: Cents
}

export function cashForecast(input: {
  readonly accounts: readonly CashAccount[]
  readonly view: View
  /** The month's rows in this view (`IncomeStatement.rows`), Pago and Previsto. */
  readonly rows: readonly IncomeStatementRow[]
  /** Accounts the person hid with the eye — on screen only, never stored. */
  readonly hidden: ReadonlySet<string>
}): CashForecast {
  const inView = input.accounts.filter(
    (account) => input.view === 'Consolidated' || account.entity === input.view,
  )
  const accounts = inView.map((account) => ({ ...account, hidden: input.hidden.has(account.id) }))
  const balanceToday = accounts
    .filter((account) => !account.hidden)
    .reduce((total, account) => add(total, account.balance), ZERO)
  const stillPlanned = input.rows
    .filter((row) => row.status === 'Planned')
    .reduce(
      (total, row) =>
        (row.flow ?? 'Out') === 'In' ? add(total, row.amount) : subtract(total, row.amount),
      cents(0),
    )
  return { accounts, balanceToday, stillPlanned, endOfMonth: add(balanceToday, stillPlanned) }
}

export interface CashBridge {
  /** Visible accounts' balance on the 1st: today's minus what the statement moved this month. */
  readonly balanceAtStart: Cents
  readonly netProfit: Cents
  /**
   * What moved the cash and is not result — transfers, investment deposits,
   * card bill payments, a manual balance edited by hand. It is the remainder
   * that closes the bridge, never computed line by line: those movements live
   * outside the DRE on purpose (PRD §5).
   */
  readonly outsideResult: Cents
  readonly endOfMonth: Cents
}

/**
 * "Do início ao fim do mês" (owner, 2026-10-09: "queria ver o Lucro Líquido +
 * o caixa do mês para entender o dinheiro do mês"). Lucro Líquido and today's
 * balance cannot simply be added — the paid part of the profit is already in
 * the balance — so the bridge starts at the balance on the 1st instead.
 *
 * `monthMovement` is the signed sum of the month's bank statement per account
 * (linked accounts only). An account without one is taken as unchanged since
 * the 1st, and any hand edit to it lands in `outsideResult`.
 */
export function cashBridge(
  forecast: CashForecast,
  input: {
    readonly monthMovement: ReadonlyMap<string, Cents>
    /** The month's complete forecast profit (Pago + Previsto) in the same view. */
    readonly netProfit: Cents
  },
): CashBridge {
  const balanceAtStart = forecast.accounts
    .filter((account) => !account.hidden)
    .reduce(
      (total, account) =>
        add(total, subtract(account.balance, input.monthMovement.get(account.id) ?? ZERO)),
      ZERO,
    )
  return {
    balanceAtStart,
    netProfit: input.netProfit,
    outsideResult: subtract(subtract(forecast.endOfMonth, balanceAtStart), input.netProfit),
    endOfMonth: forecast.endOfMonth,
  }
}
