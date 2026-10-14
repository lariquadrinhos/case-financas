import { describe, expect, it } from 'vitest'
import { asId, cents, isoDate, month, ZERO } from '@/domain/core'
import type {
  BankAccountId,
  CategoryId,
  Cents,
  EntryId,
  InstallmentId,
  InvestmentId,
  LiabilityId,
} from '@/domain/core'
import { BLOCK_IDS, type ChartOfAccounts } from '@/domain/chart-of-accounts/types'
import { initializeChartOfAccounts } from '@/domain/chart-of-accounts/rules'
import type { Entry } from '@/domain/entries'
import type { Installment, Investment, Liability } from '@/domain/assets'
import { EMPTY_BALANCE_SHEET_GROUP } from './balance-sheet'
import { computeIncomeStatement } from './income-statement'
import { computeFinancialIndicators } from './indicators'
import type { FinancialIndicatorsInput } from './indicators'
import type { BalanceSheet, Indicator, IndicatorKey } from './types'

const CHART: ChartOfAccounts = initializeChartOfAccounts()
const PF_ACCOUNT = asId<BankAccountId>('conta-pf')
const JULY = month('2026-07')

function categoryIn(blockKey: keyof typeof BLOCK_IDS): CategoryId {
  const found = CHART.categories.find((c) => c.blockId === BLOCK_IDS[blockKey])
  if (!found) throw new Error(`no default category in block ${blockKey}`)
  return found.id
}

function categoryNamed(name: string): CategoryId {
  const found = CHART.categories.find((c) => c.name === name)
  if (!found) throw new Error(`no default category named ${name}`)
  return found.id
}

let sequence = 0
const nextId = () => asId<EntryId>(`entry-${(sequence += 1)}`)

function revenue(amount: Cents, categoryId: CategoryId = categoryIn('grossRevenue')): Entry {
  return {
    id: nextId(),
    kind: 'Revenue',
    amount,
    date: isoDate('2026-07-10'),
    status: 'Paid',
    recurrenceId: null,
    entity: 'PJ',
    categoryId,
    classification: 'Current',
    bankAccountId: PF_ACCOUNT,
  } as Entry
}

function expense(
  amount: Cents,
  blockKey: keyof typeof BLOCK_IDS = 'administrativeExpenses',
): Entry {
  return {
    id: nextId(),
    kind: 'Expense',
    amount,
    date: isoDate('2026-07-10'),
    status: 'Paid',
    recurrenceId: null,
    entity: 'PF',
    categoryId: categoryIn(blockKey),
    classification: 'Current',
    bankAccountId: PF_ACCOUNT,
  } as Entry
}

function statementOf(entries: readonly Entry[]) {
  return computeIncomeStatement({
    entries,
    chart: CHART,
    view: 'Consolidated',
    month: JULY,
    statusFilter: 'Paid',
  })
}

const EMPTY_BALANCE_SHEET: BalanceSheet = {
  view: 'Consolidated',
  asOf: isoDate('2026-07-20'),
  currentAssets: EMPTY_BALANCE_SHEET_GROUP,
  nonCurrentAssets: EMPTY_BALANCE_SHEET_GROUP,
  currentLiabilities: EMPTY_BALANCE_SHEET_GROUP,
  nonCurrentLiabilities: EMPTY_BALANCE_SHEET_GROUP,
  totalAssets: ZERO,
  totalLiabilities: ZERO,
  netWorth: ZERO,
}

function baseInput(overrides: Partial<FinancialIndicatorsInput> = {}): FinancialIndicatorsInput {
  return {
    month: JULY,
    view: 'Consolidated',
    statement: statementOf([]),
    chart: CHART,
    balanceSheet: EMPTY_BALANCE_SHEET,
    investments: [],
    liabilities: [],
    installments: [],
    investmentContributionsThisMonth: null,
    priorInvestmentsTotal: null,
    ...overrides,
  }
}

function indicatorsOf(indicators: readonly Indicator[], key: IndicatorKey): Indicator {
  const found = indicators.find((i) => i.key === key)
  if (!found) throw new Error(`indicator ${key} not found`)
  return found
}

function allIndicators(
  result: ReturnType<typeof computeFinancialIndicators>,
): readonly Indicator[] {
  return [
    ...result.profitability,
    ...result.liquidity,
    ...result.leverage,
    ...result.netWorthGrowth,
    ...result.financialQualityOfLife,
  ]
}

/* ---------------------------------------------- files_design/08 §10 — shape */

describe('computeFinancialIndicators — the catalogue shape', () => {
  it('computes exactly the 18 indicators of INDICATOR_DEFINITIONS, once each', () => {
    const result = computeFinancialIndicators(baseInput())
    const keys = allIndicators(result).map((i) => i.key)
    expect(keys).toHaveLength(18)
    expect(new Set(keys).size).toBe(18)
  })

  it('groups each indicator under its own family array', () => {
    const result = computeFinancialIndicators(baseInput())
    expect(result.profitability.map((i) => i.key)).toEqual([
      'grossMargin',
      'ebitdaMargin',
      'ebitMargin',
      'netMargin',
      'returnOnEquity',
      'savingsRate',
    ])
    expect(result.liquidity.map((i) => i.key)).toEqual(['currentRatio', 'generalLiquidityRatio'])
  })
})

/* --------------------------------- files_design/08 §10 — divisão por zero */

describe('computeFinancialIndicators — a zero denominator is a dash, never NaN or Infinity', () => {
  it('grossMargin is null when there is no revenue at all', () => {
    const result = computeFinancialIndicators(
      baseInput({ statement: statementOf([expense(cents(500_00))]) }),
    )
    expect(indicatorsOf(result.profitability, 'grossMargin').value).toBeNull()
  })

  it('currentRatio is null when current liabilities are zero', () => {
    const balanceSheet: BalanceSheet = {
      ...EMPTY_BALANCE_SHEET,
      currentAssets: { total: cents(500_000), items: [] },
    }
    const result = computeFinancialIndicators(baseInput({ balanceSheet }))
    expect(indicatorsOf(result.liquidity, 'currentRatio').value).toBeNull()
  })

  it('emergencyReserve is null on a month with no cost of living recorded', () => {
    const result = computeFinancialIndicators(baseInput())
    expect(indicatorsOf(result.financialQualityOfLife, 'emergencyReserve').value).toBeNull()
  })

  it('never returns NaN or Infinity for any of the 18, on a completely empty input', () => {
    const result = computeFinancialIndicators(baseInput())
    for (const indicator of allIndicators(result)) {
      if (typeof indicator.value === 'number') {
        expect(Number.isNaN(indicator.value)).toBe(false)
        expect(Number.isFinite(indicator.value)).toBe(true)
      }
    }
  })
})

/* ------------------------------------------------------- monetary vs. ratio */

describe('computeFinancialIndicators — unit split', () => {
  it('monthlyCostOfLiving is the only Cents-valued indicator, and it is exact, not a ratio', () => {
    const result = computeFinancialIndicators(
      baseInput({ statement: statementOf([expense(cents(550_000), 'personalExpenses')]) }),
    )
    const indicator = indicatorsOf(result.financialQualityOfLife, 'monthlyCostOfLiving')
    expect(indicator.unit).toBe('BRL')
    expect(indicator.value).toBe(550_000)
  })
})

/* --------------------------------------------------------- rentabilidade */

describe('computeFinancialIndicators — Rentabilidade', () => {
  it('grossMargin, ebitdaMargin, ebitMargin and netMargin over gross revenue', () => {
    const statement = statementOf([revenue(cents(1_000_000)), expense(cents(400_000))])
    const result = computeFinancialIndicators(baseInput({ statement }))
    // Sem dedução e sem CSV lançados, o Lucro Bruto é a própria Receita Bruta:
    // margem bruta 100%. A despesa deste caso é Administrativa, que entra só a
    // partir do EBITDA.
    expect(indicatorsOf(result.profitability, 'grossMargin').value).toBeCloseTo(100)
    // EBITDA = 1.000.000 - 400.000 = 600.000 -> 60%.
    expect(indicatorsOf(result.profitability, 'ebitdaMargin').value).toBeCloseTo(60)
    expect(indicatorsOf(result.profitability, 'ebitMargin').value).toBeCloseTo(60)
    expect(indicatorsOf(result.profitability, 'netMargin').value).toBeCloseTo(60)
  })

  /**
   * P44 — decisão de produto de 2026-09-08. A margem bruta lia o subtotal
   * impresso da cascata, que é a Receita Líquida (Receita Bruta − Deduções),
   * então ela media "1 − taxa de dedução" e o CSV não a afetava. Agora lê
   * `statement.grossProfit`, que desconta o CSV — o Lucro Bruto da planilha de
   * referência (`LUCRO BRUTO = C17-C26`).
   *
   * Este caso separa as duas leituras: com 1.000.000 de receita e 300.000 de
   * CSV, a fórmula antiga daria 100% e a certa dá 70%.
   */
  it('P44 — grossMargin desconta o CSV, e por isso não é mais a Receita Líquida sobre a Receita Bruta', () => {
    const statement = statementOf([
      revenue(cents(1_000_000)),
      expense(cents(300_000), 'costOfServices'),
    ])
    const result = computeFinancialIndicators(baseInput({ statement }))

    expect(indicatorsOf(result.profitability, 'grossMargin').value).toBeCloseTo(70)
  })

  it('returnOnEquity reads net profit against Patrimônio Líquido, not against revenue', () => {
    const statement = statementOf([revenue(cents(200_000))])
    const balanceSheet: BalanceSheet = { ...EMPTY_BALANCE_SHEET, netWorth: cents(2_000_000) }
    const result = computeFinancialIndicators(baseInput({ statement, balanceSheet }))
    expect(indicatorsOf(result.profitability, 'returnOnEquity').value).toBeCloseTo(10)
  })
})

/* ----------------------------------------------------------- endividamento */

describe('computeFinancialIndicators — Endividamento', () => {
  it('debtRatio and debtToEquity read off the balance sheet totals', () => {
    const balanceSheet: BalanceSheet = {
      ...EMPTY_BALANCE_SHEET,
      totalAssets: cents(1_000_000),
      totalLiabilities: cents(400_000),
      netWorth: cents(600_000),
    }
    const result = computeFinancialIndicators(baseInput({ balanceSheet }))
    expect(indicatorsOf(result.leverage, 'debtRatio').value).toBeCloseTo(40)
    expect(indicatorsOf(result.leverage, 'debtToEquity').value).toBeCloseTo(
      (400_000 / 600_000) * 100,
    )
  })

  it('incomeCommitment counts only the instalments due in this month, in this view', () => {
    const liability: Liability = {
      id: asId<LiabilityId>('l1'),
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
    }
    const dueThisMonth: Installment = {
      id: asId<InstallmentId>('p1'),
      liabilityId: liability.id,
      number: 7,
      plannedDate: isoDate('2026-07-10'),
      plannedAmount: cents(150_000),
      status: 'Planned',
      paidAmount: null,
      paidDate: null,
      discarded: false,
    }
    const dueNextMonth: Installment = {
      ...dueThisMonth,
      id: asId<InstallmentId>('p2'),
      number: 8,
      plannedDate: isoDate('2026-08-10'),
    }
    const statement = statementOf([revenue(cents(1_500_000))])
    const result = computeFinancialIndicators(
      baseInput({
        statement,
        liabilities: [liability],
        installments: [dueThisMonth, dueNextMonth],
      }),
    )
    // 150.000 / 1.500.000 = 10% — the August instalment must not be counted.
    expect(indicatorsOf(result.leverage, 'incomeCommitment').value).toBeCloseTo(10)
  })
})

/* -------------------------------------------------- crescimento patrimonial */

describe('computeFinancialIndicators — Crescimento Patrimonial (P21: PL history assumption)', () => {
  it('netWorthGrowth reads net profit against the net worth BEFORE this month’s profit', () => {
    // Current net worth already includes this month's 100.000 of profit.
    const statement = statementOf([revenue(cents(100_000))])
    const balanceSheet: BalanceSheet = { ...EMPTY_BALANCE_SHEET, netWorth: cents(1_100_000) }
    const result = computeFinancialIndicators(baseInput({ statement, balanceSheet }))
    // priorNetWorth = 1.100.000 - 100.000 = 1.000.000; growth = 100.000/1.000.000 = 10%.
    expect(indicatorsOf(result.netWorthGrowth, 'netWorthGrowth').value).toBeCloseTo(10)
  })

  it('is null on day one, when prior net worth is honestly zero', () => {
    // A fresh install: net worth today equals exactly this month's profit.
    const statement = statementOf([revenue(cents(50_000))])
    const balanceSheet: BalanceSheet = { ...EMPTY_BALANCE_SHEET, netWorth: cents(50_000) }
    const result = computeFinancialIndicators(baseInput({ statement, balanceSheet }))
    expect(indicatorsOf(result.netWorthGrowth, 'netWorthGrowth').value).toBeNull()
  })

  it('investmentGrowth and contributionEfficiency are null when no ProfitAllocation exists for the month', () => {
    const result = computeFinancialIndicators(baseInput({ investmentContributionsThisMonth: null }))
    expect(indicatorsOf(result.netWorthGrowth, 'investmentGrowth').value).toBeNull()
    expect(indicatorsOf(result.financialQualityOfLife, 'contributionEfficiency').value).toBeNull()
  })

  it('investmentGrowth and contributionEfficiency compute once a contribution figure is supplied', () => {
    const investment: Investment = {
      id: asId<InvestmentId>('i1'),
      name: 'Tesouro',
      entity: 'PF',
      accumulatedValue: cents(1_100_000),
    }
    const statement = statementOf([revenue(cents(500_000))])
    const result = computeFinancialIndicators(
      baseInput({
        statement,
        investments: [investment],
        investmentContributionsThisMonth: cents(100_000),
        // P22: o mês anterior vem do RETRATO, não mais de `total − aporte`.
        // O número esperado é o mesmo porque o cenário é o mesmo; o que mudou
        // é de onde ele sai.
        priorInvestmentsTotal: cents(1_000_000),
      }),
    )
    // (1.100.000 − 1.000.000) / 1.000.000 -> growth 10%.
    expect(indicatorsOf(result.netWorthGrowth, 'investmentGrowth').value).toBeCloseTo(10)
    // contributionEfficiency = 100.000 / 500.000 (netProfit) = 20%.
    expect(indicatorsOf(result.financialQualityOfLife, 'contributionEfficiency').value).toBeCloseTo(
      20,
    )
  })
})

/* ------------------------------------------------- qualidade de vida (P22) */

describe('computeFinancialIndicators — renda passiva e consumo livre (P22: matched by category name)', () => {
  it('passiveIncomeCoverage counts only the two passive-income categories, not all revenue', () => {
    const rent = revenue(cents(200_000), categoryNamed('Aluguel recebido'))
    const salary = revenue(cents(800_000), categoryNamed('Salário/Pró-labore'))
    const statement = statementOf([rent, salary, expense(cents(400_000), 'personalExpenses')])
    const result = computeFinancialIndicators(baseInput({ statement }))
    // 200.000 (aluguel apenas) / 400.000 (custo de vida) = 50%.
    expect(indicatorsOf(result.financialQualityOfLife, 'passiveIncomeCoverage').value).toBeCloseTo(
      50,
    )
  })

  /**
   * P22: os dois indicadores de renda passiva casavam a categoria pelo NOME
   * ("Aluguel recebido", "Dividendos/Rendimentos de investimentos externos").
   * O nome é texto livre que a pessoa edita — o Plano de Contas tem "Editar"
   * em toda categoria (Figma 44:2) — então renomear "Aluguel recebido" pra
   * qualquer outra coisa fazia o indicador parar de contar aquela receita,
   * sem erro e sem aviso: só um número menor no relatório.
   *
   * O id, esse sim, é estável: `renameCategory` só troca `name`
   * (src/domain/chart-of-accounts/rules.ts), e os Lançamentos apontam pro id.
   */
  it('P22 — conta a renda passiva mesmo depois de a categoria ser renomeada', () => {
    const renamedChart: ChartOfAccounts = {
      ...CHART,
      categories: CHART.categories.map((category) =>
        category.id === categoryNamed('Aluguel recebido')
          ? { ...category, name: 'Aluguel do apartamento' }
          : category,
      ),
    }
    const rent = revenue(cents(200_000), categoryNamed('Aluguel recebido'))
    const statement = computeIncomeStatement({
      entries: [rent, expense(cents(400_000), 'personalExpenses')],
      chart: renamedChart,
      view: 'Consolidated',
      month: JULY,
      statusFilter: 'Paid',
    })

    const result = computeFinancialIndicators(baseInput({ statement }))

    // Mesmos 200.000 / 400.000 = 50% do teste acima: renomear não muda o valor.
    expect(indicatorsOf(result.financialQualityOfLife, 'passiveIncomeCoverage').value).toBeCloseTo(
      50,
    )
  })

  /**
   * P22, metade que continuava aberta e foi decidida em 2026-09-08: uma
   * categoria que a PESSOA cria pra renda passiva ("Dividendos XP", um segundo
   * imóvel alugado) não entrava no indicador — só as duas de referência
   * contavam. Agora `Category.isPassiveIncome` é o que decide, e a pessoa marca
   * a categoria dela no Plano de Contas.
   */
  it('P22 — conta uma categoria de renda passiva criada pela pessoa, marcada por ela', () => {
    const ownCategoryId = asId<CategoryId>('dividendos-xp')
    const chartWithOwn: ChartOfAccounts = {
      ...CHART,
      categories: [
        ...CHART.categories,
        {
          id: ownCategoryId,
          blockId: BLOCK_IDS.grossRevenue,
          name: 'Dividendos XP',
          isSystem: false,
          suggestedClassification: null,
          archived: false,
          isPassiveIncome: true,
        },
      ],
    }
    const statement = computeIncomeStatement({
      entries: [
        revenue(cents(200_000), ownCategoryId),
        expense(cents(400_000), 'personalExpenses'),
      ],
      chart: chartWithOwn,
      view: 'Consolidated',
      month: JULY,
      statusFilter: 'Paid',
    })

    const result = computeFinancialIndicators(baseInput({ statement, chart: chartWithOwn }))

    // 200.000 / 400.000 = 50%, igual às categorias de referência.
    expect(indicatorsOf(result.financialQualityOfLife, 'passiveIncomeCoverage').value).toBeCloseTo(
      50,
    )
  })

  it('discretionaryOverFreeCashFlow reads only the "Consumo Livre" category against net profit', () => {
    const discretionary = expense(cents(100_000), 'personalExpenses')
    // Force the discretionary expense onto the system "Consumo Livre" category.
    const asDiscretionary: Entry = {
      ...discretionary,
      categoryId: categoryNamed('Consumo Livre'),
    } as Entry
    const statement = statementOf([revenue(cents(1_000_000)), asDiscretionary])
    const result = computeFinancialIndicators(baseInput({ statement }))
    // netProfit = 1.000.000 - 100.000 = 900.000; 100.000/900.000 ≈ 11,1%.
    expect(
      indicatorsOf(result.financialQualityOfLife, 'discretionaryOverFreeCashFlow').value,
    ).toBeCloseTo((100_000 / 900_000) * 100)
  })
})

/* ------------------------------------------------------------- 3 visões */

describe('computeFinancialIndicators — the same month, three different views', () => {
  it('incomeCommitment only counts a liability that is in the requested view', () => {
    const pfLiability: Liability = {
      id: asId<LiabilityId>('l1'),
      name: 'Financiamento PF',
      creditor: 'Banco',
      entity: 'PF',
      classification: 'NonCurrent',
      originalAmount: cents(0),
      installmentAmount: cents(0),
      installmentCount: 1,
      installmentsAlreadyPaid: 0,
      monthlyInterestRate: 0,
      startDate: isoDate('2026-01-10'),
    }
    const installment: Installment = {
      id: asId<InstallmentId>('p1'),
      liabilityId: pfLiability.id,
      number: 1,
      plannedDate: isoDate('2026-07-10'),
      plannedAmount: cents(100_000),
      status: 'Planned',
      paidAmount: null,
      paidDate: null,
      discarded: false,
    }
    const statement = statementOf([revenue(cents(1_000_000))])
    const pjResult = computeFinancialIndicators(
      baseInput({
        view: 'PJ',
        statement,
        liabilities: [pfLiability],
        installments: [installment],
      }),
    )
    // The PF liability must not count against the PJ's income commitment.
    expect(indicatorsOf(pjResult.leverage, 'incomeCommitment').value).toBe(ZERO)
  })
})

/**
 * P22 — "Crescimento dos investimentos (mês)" passa a ser MEDIDO.
 *
 * A conta antiga deduzia o mês anterior: `total_atual − aporte`, assumindo que
 * só a Destinação do Lucro mexia nos investimentos. A ADR-0017 §4 tornou isso
 * falso de vez — direcionar uma venda para um investimento sobe o
 * `accumulatedValue` sem passar por balde nenhum.
 *
 * Medido em 2026-09-11 com o cenário abaixo: a conta antiga mostrava **4,2%**
 * onde o certo são **25%**, um erro de seis vezes.
 *
 * O retrato resolve os dois lados de uma vez, e a razão está no próprio texto
 * de ajuda do indicador: "Não inclui rendimento: o produto não reavalia
 * investimento". Se nada reavalia, todo aumento no total É aporte — então medir
 * o total de dois meses dá o aporte sem precisar somar fonte por fonte.
 */
describe('P22 — crescimento dos investimentos medido por retrato', () => {
  const investimento = (valor: number): Investment => ({
    id: asId<InvestmentId>('i-sintetico'),
    name: 'Investimento Sintético',
    entity: 'PF',
    accumulatedValue: cents(valor),
  })

  it('usa o retrato do mês anterior, não a dedução', () => {
    const result = computeFinancialIndicators(
      baseInput({
        // 100.000 no fim do mês passado; hoje 125.000 (5.000 de lucro + 20.000
        // de uma venda direcionada). A dedução daria 4,2%.
        investments: [investimento(12_500_000)],
        investmentContributionsThisMonth: cents(500_000),
        priorInvestmentsTotal: cents(10_000_000),
      }),
    )
    expect(indicatorsOf(result.netWorthGrowth, 'investmentGrowth').value).toBeCloseTo(25)
  })

  it('sem retrato do mês anterior, mostra travessão em vez de um número deduzido', () => {
    const result = computeFinancialIndicators(
      baseInput({
        investments: [investimento(12_500_000)],
        investmentContributionsThisMonth: cents(500_000),
        priorInvestmentsTotal: null,
      }),
    )
    expect(indicatorsOf(result.netWorthGrowth, 'investmentGrowth').value).toBeNull()
  })

  it('"Eficiência de aporte" NÃO muda: ela pergunta que parte do LUCRO virou aporte', () => {
    const result = computeFinancialIndicators(
      baseInput({
        statement: statementOf([revenue(cents(500_000))]),
        investments: [investimento(12_500_000)],
        investmentContributionsThisMonth: cents(100_000),
        priorInvestmentsTotal: cents(10_000_000),
      }),
    )
    // 100.000 / 500.000 de lucro líquido. Dinheiro de venda não é lucro do mês,
    // e por isso continua fora deste numerador.
    expect(indicatorsOf(result.financialQualityOfLife, 'contributionEfficiency').value).toBeCloseTo(
      20,
    )
  })
})
