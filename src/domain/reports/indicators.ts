/**
 * Indicadores Financeiros — the 18-indicator catalogue of `types.ts`
 * (`INDICATOR_DEFINITIONS`), computed for one month, in one view
 * (files_design/08 §10, PRD "Indicadores Financeiros").
 *
 * No source spells out a formula for any of the 18 — the PRD and
 * files_design/08 fix the label, the family and the display format only. Every
 * formula below is an engineering reading of the standard ratio the label
 * names, using only what the domain already computes (`IncomeStatement`,
 * `BalanceSheet`) plus the smallest possible set of extra aggregates from
 * `assets`. See docs/PERGUNTAS-EM-ABERTO.md (P21, P22) for what is assumed and
 * what changes if Produto answers differently.
 *
 * `null` is the domain's honest answer for two DIFFERENT situations that both
 * read as a dash on screen (files_design/08 §10): a zero denominator, and "not
 * enough history yet" (e.g. a fresh install, where net worth a month ago is
 * indistinguishable from net worth today minus zero profit). This module does
 * not need a separate "insufficient history" flag for most indicators — see
 * `netWorthGrowth` below — precisely because dividing by an honestly-zero prior
 * value already produces the dash.
 */

import {
  type Cents,
  type Entity,
  type Month,
  type View,
  add,
  monthOf,
  percentOf,
  subtract,
} from '@/domain/core'
import { BLOCK_IDS, type ChartOfAccounts } from '@/domain/chart-of-accounts'
import type { Installment, Investment, Liability } from '@/domain/assets'
import {
  INDICATOR_DEFINITIONS,
  type BalanceSheet,
  type FinancialIndicators,
  type Indicator,
  type IncomeStatement,
  type IndicatorKey,
} from './types'

export interface FinancialIndicatorsInput {
  readonly month: Month
  readonly view: View
  /** `computeIncomeStatement` for `month`/`view`, on the requested Pago/Previsto basis. */
  readonly statement: IncomeStatement
  /**
   * The same chart the statement was computed with. Read for ONE thing: which
   * categories the person marked as renda passiva (`Category.isPassiveIncome`).
   * `reports` may depend on `chart-of-accounts` (src/domain/README.md, "a regra
   * de dependência"), and `computeIncomeStatement` already takes it.
   */
  readonly chart: ChartOfAccounts
  /** `computeBalanceSheet` for `view`, "now" — the Balanço has no history (PRD §5). */
  readonly balanceSheet: BalanceSheet
  readonly investments: readonly Investment[]
  readonly liabilities: readonly Liability[]
  /** Every installment of every liability above — filtered to `month` internally. */
  readonly installments: readonly Installment[]
  /**
   * Aportes de investimento feitos a partir da Destinação do Lucro no mês
   * (buckets "Aporte em Investimentos" + "Reinvestimento de Dividendos"),
   * `null` when there is no `ProfitAllocation` recorded for `month`.
   *
   * Vem PRONTO de quem chama, e não é lacuna: `reports` pode depender só de
   * `entries`, `chart-of-accounts` e `assets` (src/domain/README.md, "a regra
   * de dependência"), nunca de `profit-allocation`. Quem soma os dois baldes é
   * a rota. P22, fechada em 2026-09-11.
   *
   * Só `contributionEfficiency` mostra travessão quando isto é `null`.
   * `investmentGrowth` deixou de depender deste número: ele passou a medir o
   * total investido contra o retrato do mês anterior — ver
   * `priorInvestmentsTotal` logo abaixo.
   */
  readonly investmentContributionsThisMonth: Cents | null
  /**
   * O total investido no fim do mês ANTERIOR, lido do retrato mensal
   * (`net_worth_snapshots`), `null` quando não há retrato daquele mês — numa
   * instalação nova, ou no primeiro mês.
   *
   * P22, 2026-09-11. Antes disto o mês anterior era DEDUZIDO como
   * `total_atual − aporte`, o que assume que só a Destinação do Lucro mexe nos
   * investimentos. A ADR-0017 §4 tornou a suposição falsa de vez: direcionar
   * uma venda para um investimento sobe o `accumulatedValue` sem passar por
   * balde nenhum. Medido no cenário de 100k + 5k de lucro + 20k de venda, a
   * dedução mostrava 4,2% onde o certo são 25%.
   *
   * Medir os dois meses basta porque o produto NÃO REAVALIA investimento (é o
   * que o texto de ajuda do indicador diz): se nada rende, todo aumento no
   * total é aporte, e somar fonte por fonte seria o caminho longo para o mesmo
   * número — com o agravante de que os direcionamentos de venda nem são
   * persistidos.
   */
  readonly priorInvestmentsTotal: Cents | null
}

/** Same rule as `balance-sheet.ts`'s `isInView` — Consolidado sees both entities. */
function isInView(entity: Entity, view: View): boolean {
  return view === 'Consolidated' || view === entity
}

function blockAmount(statement: IncomeStatement, key: string): Cents {
  const line = statement.lines.find((l) => l.kind === 'block' && l.key === key)
  if (line === undefined) throw new Error('indicators.missing_block')
  return line.amount
}

function subtotalAmount(statement: IncomeStatement, key: 'netRevenue' | 'ebitda' | 'ebit'): Cents {
  const line = statement.lines.find((l) => l.kind === 'subtotal' && l.key === key)
  if (line === undefined) throw new Error('indicators.missing_subtotal')
  return line.amount
}

/** A raw ratio (Liquidez, Reserva de emergência), never scaled to percentage points. */
function ratio(part: Cents, total: Cents): number | null {
  if (total === 0) return null
  return part / total
}

/**
 * Renda passiva — whichever categories the person marked
 * (`Category.isPassiveIncome`). Ships `true` on the two the PRD's reference
 * chart names, "Aluguel recebido" and "Dividendos/Rendimentos de investimentos
 * externos" (bloco 1), and the person marks their own in the Plano de Contas.
 *
 * Two things this fixed, both P22, both measured:
 *  - it used to match the DEFAULT NAME, so renaming "Aluguel recebido" dropped
 *    `passiveIncomeCoverage` from 50% to 0% with no error and no warning — the
 *    name is free text with an "Editar" on every line (Figma 44:2), while
 *    `renameCategory` never touches the id;
 *  - and then, matching a fixed pair of ids, a category the PERSON created for
 *    passive income was silently left out of the ratio. The flag is what lets
 *    her say so, instead of the domain guessing.
 *
 * Both cases are pinned in `indicators.test.ts` ("P22 — …renomeada" and
 * "P22 — …criada pela pessoa, marcada por ela").
 */
function passiveIncomeCategoryIds(chart: ChartOfAccounts): ReadonlySet<string> {
  return new Set(
    chart.categories.filter((category) => category.isPassiveIncome).map((category) => category.id),
  )
}

/** "Consumo Livre", the system category the widget always posts to. */
const DISCRETIONARY_CATEGORY_ID = 'consumo-livre'

/**
 * Sums the rows of one block whose category is in `categoryIds`. The block
 * MUST be passed in, not fixed to Receita Bruta: "Consumo Livre" (used below
 * for `discretionarySpending`) lives in Despesas Pessoais, not Receita Bruta —
 * hard-coding the block here silently zeroed that indicator every month.
 */
function sumRowsOfCategories(
  statement: IncomeStatement,
  blockId: (typeof BLOCK_IDS)[keyof typeof BLOCK_IDS],
  categoryIds: ReadonlySet<string>,
): Cents {
  return add(
    ...statement.rows
      .filter(
        (row) =>
          row.blockId === blockId && row.categoryId !== null && categoryIds.has(row.categoryId),
      )
      .map((row) => row.amount),
  )
}

function monthlyDebtService(
  month: Month,
  view: View,
  liabilities: readonly Liability[],
  installments: readonly Installment[],
): Cents {
  const liabilityById = new Map(liabilities.map((liability) => [liability.id, liability]))
  return add(
    ...installments
      .filter((installment) => monthOf(installment.plannedDate) === month)
      .filter((installment) => {
        const liability = liabilityById.get(installment.liabilityId)
        return liability !== undefined && isInView(liability.entity, view)
      })
      .map((installment) => installment.plannedAmount),
  )
}

export function computeFinancialIndicators(input: FinancialIndicatorsInput): FinancialIndicators {
  const {
    month,
    view,
    statement,
    chart,
    balanceSheet,
    investments,
    liabilities,
    installments,
    investmentContributionsThisMonth,
    priorInvestmentsTotal,
  } = input

  const grossRevenue = blockAmount(statement, BLOCK_IDS.grossRevenue)
  const netRevenue = subtotalAmount(statement, 'netRevenue')
  const ebitda = subtotalAmount(statement, 'ebitda')
  const ebit = subtotalAmount(statement, 'ebit')
  const netProfit = statement.netProfit

  const monthlyCostOfLiving = blockAmount(statement, BLOCK_IDS.personalExpenses)
  const discretionarySpending = sumRowsOfCategories(
    statement,
    BLOCK_IDS.personalExpenses,
    new Set([DISCRETIONARY_CATEGORY_ID]),
  )
  const passiveIncome = sumRowsOfCategories(
    statement,
    BLOCK_IDS.grossRevenue,
    passiveIncomeCategoryIds(chart),
  )

  const investmentsAccumulated = add(
    ...investments.filter((i) => isInView(i.entity, view)).map((i) => i.accumulatedValue),
  )

  // "Crescimento do PL (mês)" assumes net profit is the ONLY thing that moved
  // the patrimônio líquido since a month ago, the same assumption
  // `monthly-trend.ts` makes for the same reason: the Balanço has no history
  // (see that file's header comment and P21). A brand-new install has
  // `priorNetWorth === netProfit subtracted from itself's starting point`,
  // i.e. whatever was there before this month's profit — which is genuinely
  // zero on day one, so the ratio correctly comes back as a dash.
  const priorNetWorth = subtract(balanceSheet.netWorth, netProfit)
  const priorInvestments = priorInvestmentsTotal

  const values: Record<IndicatorKey, Indicator['value']> = {
    // P44: desconta o CSV. Antes lia o subtotal da cascata, que é Receita
    // Líquida — a "margem bruta" media "1 − taxa de dedução".
    grossMargin: percentOf(statement.grossProfit, grossRevenue),
    ebitdaMargin: percentOf(ebitda, grossRevenue),
    ebitMargin: percentOf(ebit, grossRevenue),
    netMargin: percentOf(netProfit, grossRevenue),
    returnOnEquity: percentOf(netProfit, balanceSheet.netWorth),
    // Distinct from `netMargin` by design: this reads against Receita Líquida,
    // e agora o subtotal se chama assim (P44). O comentário anterior já
    // descrevia o valor certo com o nome errado.
    savingsRate: percentOf(netProfit, netRevenue),

    currentRatio: ratio(balanceSheet.currentAssets.total, balanceSheet.currentLiabilities.total),
    generalLiquidityRatio: ratio(balanceSheet.totalAssets, balanceSheet.totalLiabilities),

    debtRatio: percentOf(balanceSheet.totalLiabilities, balanceSheet.totalAssets),
    debtToEquity: percentOf(balanceSheet.totalLiabilities, balanceSheet.netWorth),
    incomeCommitment: percentOf(
      monthlyDebtService(month, view, liabilities, installments),
      grossRevenue,
    ),

    netWorthGrowth: percentOf(netProfit, priorNetWorth),
    // Medido, não deduzido (P22): a diferença entre o total de hoje e o retrato
    // do mês passado. O texto de ajuda continua verdadeiro — "quanto você
    // aportou no mês comparado ao que já tinha investido" — porque sem
    // reavaliação todo aumento é aporte.
    investmentGrowth:
      priorInvestments === null
        ? null
        : percentOf(subtract(investmentsAccumulated, priorInvestments), priorInvestments),

    monthlyCostOfLiving,
    emergencyReserve: ratio(balanceSheet.currentAssets.total, monthlyCostOfLiving),
    passiveIncomeCoverage: percentOf(passiveIncome, monthlyCostOfLiving),
    discretionaryOverFreeCashFlow: percentOf(discretionarySpending, netProfit),
    contributionEfficiency:
      investmentContributionsThisMonth === null
        ? null
        : percentOf(investmentContributionsThisMonth, netProfit),
  }

  const indicatorOf = (key: IndicatorKey): Indicator => {
    const definition = INDICATOR_DEFINITIONS.find((d) => d.key === key)
    if (definition === undefined) throw new Error('indicators.unknown_key')
    const value = values[key]
    // The union splits on `unit` alone (types.ts `Indicator`), so the branch
    // has to happen here rather than trusting a single object literal to match.
    if (definition.unit === 'BRL') {
      return { key, label: definition.label, unit: 'BRL', value: value as Cents | null }
    }
    return {
      key,
      label: definition.label,
      unit: definition.unit,
      value: value as number | null,
    }
  }

  const byFamily = (family: (typeof INDICATOR_DEFINITIONS)[number]['family']) =>
    INDICATOR_DEFINITIONS.filter((d) => d.family === family).map((d) => indicatorOf(d.key))

  return {
    month,
    view,
    profitability: byFamily('Profitability'),
    liquidity: byFamily('Liquidity'),
    leverage: byFamily('Leverage'),
    netWorthGrowth: byFamily('NetWorthGrowth'),
    financialQualityOfLife: byFamily('FinancialQualityOfLife'),
  }
}
