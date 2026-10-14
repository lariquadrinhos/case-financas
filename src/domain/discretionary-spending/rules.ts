/**
 * Consumo Livre — the widget's arithmetic (files_design/01 §4a,
 * files_design/08 §9.2, PRD §1/§5).
 *
 * The verba is a monthly allowance: `monthlyAmount` plus whatever leftover the
 * previous month carried forward, minus what has been spent so far. Every
 * function here is pure and takes the previous month's leftover as a
 * parameter rather than deriving it, because whether that leftover is a stored
 * record or a derived value is P14 in `docs/PERGUNTAS-EM-ABERTO.md` — an open
 * question this module does not need to answer to do its arithmetic.
 */

import { DISCRETIONARY_CATEGORY_ID } from '@/domain/chart-of-accounts'
import { ZERO, add, isNegative, subtract } from '@/domain/core'
import type { Cents, IsoDate, Month } from '@/domain/core'
import type { ExpenseEntry } from '@/domain/entries'
import type { DiscretionaryExpense, DiscretionarySpendingConfig, LeftoverDirection } from './types'

/** PRD §1: a gasto de Consumo Livre is never negative. */
export function assertValidExpenseAmount(amount: Cents): void {
  if (isNegative(amount)) {
    throw new Error('discretionary_spending.negative_amount')
  }
}

/** The sum of every gasto in the widget's history for the month. */
export function totalSpent(expenses: readonly DiscretionaryExpense[]): Cents {
  return add(...expenses.map((expense) => expense.amount))
}

/**
 * "Valor mensal" plus the previous month's leftover, registered as an explicit
 * line in the history (files_design/01 §4a) — the full amount the month's bar
 * is measured against.
 */
export function allowanceForMonth(
  // `Pick` e não o config inteiro: a regra lê UM campo, e pedir o agregado
  // todo obrigava quem chama a remarcar `sourceAccountId` sem necessidade.
  config: Pick<DiscretionarySpendingConfig, 'monthlyAmount'>,
  previousLeftover: Cents,
): Cents {
  return add(config.monthlyAmount, previousLeftover)
}

/**
 * "Saldo restante" — what is left of the month's allowance, offered to
 * "Redirecionar saldo restante" (files_design/01 §4a). Can be negative when the
 * month overspent; a negative balance is not something a screen redirects
 * (see `canRedirectRemaining`), but the arithmetic itself does not clamp,
 * because the same subtraction also answers "by how much did the month go
 * over" for `isOverLimit`.
 */
export function remainingBalance(
  config: DiscretionarySpendingConfig,
  previousLeftover: Cents,
  spent: Cents,
): Cents {
  return subtract(allowanceForMonth(config, previousLeftover), spent)
}

/**
 * "Sobra" — what a closed month hands to the next one as the explicit history
 * line "+ Sobra de {mês}, adicionada ao saldo" (Figma 345:752, nodes `192:22`
 * / `192:23` / `192:24`; PRD v7 §Consumo Livre; files_design/01 §4a).
 *
 * Clamped at zero: files_design/02 §"Pagar a mais" states the product never
 * turns a sobra into a cobrança, so a month that overspent hands forward
 * nothing rather than a debt. This is the only difference from
 * `remainingBalance`, which does not clamp because it also has to answer "by
 * how much did the month go over".
 *
 * Takes the closed month's `allowance` (what `allowanceForMonth` returns for
 * it) rather than the config, so that the caller has to say out loud which
 * allowance that month actually had — chaining leftover onto leftover, month
 * after month, is a decision no source makes.
 */
export function leftoverOfMonth(allowance: Cents, spent: Cents): Cents {
  const remaining = subtract(allowance, spent)
  return remaining > ZERO ? remaining : ZERO
}

/** Only a positive leftover can be sent somewhere — there is nothing to move otherwise. */
export function canRedirectRemaining(remaining: Cents): boolean {
  return remaining > 0
}

/**
 * How full the progress bar is, files_design/08 §9.2: "largura preenchida =
 * mín(gasto ÷ limite, 100%)". The bar fills to 100% and stops — it never
 * reads over 1, because the text beside it (`R$ gasto / R$ limite`) is what
 * still shows the real amount spent past the limit (files_design/08 §9.2:
 * "sem cor de alerta").
 *
 * A limit of zero cannot be divided by. It is not the "divisão por zero →
 * travessão" case of files_design/08 §10 (that convention is for an
 * INDICATOR, a number read on its own) — here the bar is either empty (no
 * spend against no allowance) or already overflowed (any spend at all against
 * no allowance), so the fraction is defined by convention as 0 or 1 rather
 * than displayed as a dash.
 */
export function progressFraction(spent: Cents, limit: Cents): number {
  if (limit <= ZERO) return spent > ZERO ? 1 : 0
  return Math.min(spent / limit, 1)
}

/** files_design/08 §9.2: the bar stays neutral, but the screen still needs to know. */
export function isOverLimit(spent: Cents, limit: Cents): boolean {
  return spent > limit
}

/**
 * Assembles the Lançamento a "Gastei um valor" produces (files_design/03,
 * "Consumo Livre — widget"): the fixed system category, and the account and
 * entity carried over from the config — the popover asks for the amount only.
 *
 * `status` is always `'Paid'`: the widget records money already spent, never a
 * planned one (files_design/01 §4a describes only this one flow, no "Previsto"
 * variant of a gasto de Consumo Livre).
 *
 * `classification` is `'Current'` by deduction from the criterion the Figma
 * draws, not by analogy with neighbouring categories: the Classificação
 * tooltip (Wireframe `71:11` → card `73:11` "③ Hover: Classificação") states
 * it in full — `73:23` "Circulante: previsto para até 12 meses." and `73:24`
 * "Não circulante: prazo maior que 12 meses." A gasto de Consumo Livre is
 * money already spent — `status: 'Paid'`, dated the day it is recorded,
 * because the popover asks for no date — so its horizon is zero, inside the 12
 * months. Same tooltip already transcribed at
 * `src/app/(app)/novo-lancamento/tabs/expense-revenue-fields.tsx` and cited by
 * `src/domain/chart-of-accounts/rules.ts`.
 *
 * There is no Classificação to ask for, either: the "Gastei um valor" popover
 * (Wireframe `345:1002` → dialog `345:1252`, 320×183) draws exactly four
 * children — title `345:1253`, field `345:1254`, "Confirmar" `345:1256` and
 * the caption `345:1258` "Sem categoria, sem conta, sem data pra escolher, só
 * o valor. A barra atualiza na hora." The Mockup repeats the same four
 * (`1000:2643`). The fixed category still ships with
 * `suggestedClassification: null` like every default category
 * (chart-of-accounts/types.ts `DISCRETIONARY_CATEGORY_ID`), and the person can
 * still change it afterwards from the Histórico — `73:25` "Sugestão automática
 * pode ser trocada manualmente a qualquer momento."
 */
export function buildExpenseEntry(
  config: DiscretionarySpendingConfig,
  amount: Cents,
  date: IsoDate,
): Omit<ExpenseEntry, 'id'> {
  assertValidExpenseAmount(amount)
  return {
    kind: 'Expense',
    amount,
    date,
    status: 'Paid',
    recurrenceId: null,
    entity: config.entity,
    categoryId: DISCRETIONARY_CATEGORY_ID,
    classification: 'Current',
    bankAccountId: config.sourceAccountId,
  }
}

/* -------------------------------------------------------------------------
 * Sobra do mês como Pendência — P14 (produto, 2026-09-08)
 * ---------------------------------------------------------------------- */

/**
 * Quanto da sobra de um mês ainda está sem destino.
 *
 * É o valor da Pendência da Home, e some quando chega a zero — sem sobra, não
 * há pendência, que é a resposta à sub-pergunta "e se a sobra for zero?".
 *
 * Nunca negativo: direcionar mais do que sobrou é recusado por
 * `assertDirectionFits`, e o `max(0)` aqui é rede, não regra.
 */
export function pendingLeftover(
  leftover: Cents,
  directions: readonly LeftoverDirection[],
  month: Month,
): Cents {
  const directed = directions
    .filter((d) => d.month === month)
    .reduce((total, d) => add(total, d.amount), ZERO)
  const remaining = subtract(leftover, directed)
  return remaining > ZERO ? remaining : ZERO
}

/**
 * O quanto da sobra de `previousMonth` a pessoa mandou de volta para a verba —
 * o único destino que sobe o teto do mês.
 *
 * É o que `allowanceForMonth` recebe como `previousLeftover`. O parâmetro
 * mudou de sentido na P14: era "o que sobrou", passou a ser "o que a pessoa
 * decidiu trazer". Antes, o teto subia sozinho e as telas ignoravam isso para
 * não mostrarem dois números diferentes; agora não há o que ignorar.
 */
export function leftoverBroughtForward(
  directions: readonly LeftoverDirection[],
  previousMonth: Month,
): Cents {
  return directions
    .filter((d) => d.month === previousMonth && d.destination.kind === 'Discretionary')
    .reduce((total, d) => add(total, d.amount), ZERO)
}

/** Direcionar mais do que ainda resta é recusado — a Pendência não fica negativa. */
export function assertDirectionFits(pending: Cents, amount: Cents): void {
  if (amount <= ZERO) {
    throw new Error('leftover_direction.non_positive_amount')
  }
  if (amount > pending) {
    throw new Error('leftover_direction.exceeds_pending')
  }
}

/**
 * The limit the widget's bar is measured against this month.
 *
 * `Fixed`: the allowance plus the leftover the person brought back
 * (`allowanceForMonth`). `SourceBalance`: what already left the conta de
 * origem plus what is still in it — so "what remains" is exactly the account's
 * balance, which is the whole point of the choice. `sourceBalance` is the
 * account's balance NOW, so this answers for the current month.
 */
export function monthLimit(
  config: DiscretionarySpendingConfig,
  month: { readonly previousLeftover: Cents; readonly spent: Cents; readonly sourceBalance: Cents },
): Cents {
  if (config.allowanceKind === 'SourceBalance') return add(month.spent, month.sourceBalance)
  return allowanceForMonth(config, month.previousLeftover)
}

/**
 * Whether a closed month can leave a sobra to direct (P14). With the balance
 * as the limit there is none: the money that was not spent is still in the
 * account, where it already counts.
 */
export function hasLeftover(config: DiscretionarySpendingConfig): boolean {
  return config.allowanceKind !== 'SourceBalance'
}
