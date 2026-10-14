/**
 * Relatórios — read models, never the source of truth (Event Storming Fluxo G).
 *
 * The four screens (DRE, Balanço Patrimonial, Evolução Mensal, Indicadores
 * Financeiros) are recomputed on demand from the entries and the patrimônio.
 * Nothing here is stored; these types describe what a screen renders.
 */

import type {
  BankAccountId,
  BlockId,
  CategoryId,
  Cents,
  Entity,
  EntryId,
  EntryStatus,
  InstallmentId,
  InvestmentId,
  IsoDate,
  LiabilityId,
  Month,
  TangibleAssetId,
  View,
  OccurrenceId,
  RecurrenceId,
} from '@/domain/core'

/* -------------------------------------------------------------------------
 * DRE — files_design/01 §8.1, Figma 11:2
 * ---------------------------------------------------------------------- */

/**
 * The cascade's computed lines. Blocks come from the chart of accounts; these
 * four are the results between them, and they are what the indicators refer to
 * (Event Storming H10).
 */
export const STATEMENT_SUBTOTAL_KEYS = ['netRevenue', 'ebitda', 'ebit', 'netProfit'] as const
export type StatementSubtotalKey = (typeof STATEMENT_SUBTOTAL_KEYS)[number]

export const LABEL_STATEMENT_SUBTOTAL: Record<StatementSubtotalKey, string> = {
  // "Receita Líquida", não "Lucro Bruto" — P44, decisão de produto de
  // 2026-09-08. Esta linha sempre valeu Receita Bruta − Deduções, que é o que a
  // planilha de referência chama de RECEITA LÍQUIDA (`=C10-C16`); o Lucro Bruto
  // dela desconta o CSV (`=C17-C26`) e é outra linha. O produto ficou com uma
  // só, na posição da primeira e com o nome da segunda.
  netRevenue: 'Receita Líquida',
  ebitda: 'EBITDA',
  ebit: 'EBIT',
  netProfit: 'Lucro Líquido',
}

interface StatementLineBase {
  /** pt-BR, as printed on the DRE. Blocks use their `statementLabel` when they have one. */
  readonly label: string
  readonly amount: Cents
  /**
   * Nesting depth, 0 for a top-level line. **Toda** linha da cascata é level 0
   * hoje (Figma 11:2), e o campo nasceu justificado por um futuro que não vai
   * acontecer: "a estrutura de blocos vai virar configurável" era o H10, que o
   * PRD v7 §1 e §9.5 fecharam ("os 10 blocos são fixos").
   *
   * Fica registrado como candidato a remoção, não removido aqui: ele viaja no
   * contrato HTTP (`@/api/contracts/reports`) e tirá-lo é mudança de contrato,
   * que merece a sua própria passada.
   */
  readonly level: number
}

/**
 * One line of a block's breakdown on the expandable DRE (2026-09-23): the total
 * of one Plano de Contas category — or, for what has no category, of one kind
 * (Pró-labore, Distribuição de lucro, IR) or one Passivo (its parcelas, P6).
 * Printed like the block line (`displayAmount`), so the items add up to it.
 */
export interface StatementBreakdownItem {
  /** `category:<id>`, `kind:<EntryKind>` or `liability:<id>` — stable across months. */
  readonly key: string
  readonly label: string
  readonly amount: Cents
  /** Ocultada na simulação (2026-10-01): fora do total do bloco, listada para voltar. */
  readonly hidden?: boolean
}

export interface StatementBlockLine extends StatementLineBase {
  readonly kind: 'block'
  readonly key: BlockId
  /** Largest first; empty when the block has no movement (no arrow to expand). */
  readonly breakdown: readonly StatementBreakdownItem[]
}

export interface StatementSubtotalLine extends StatementLineBase {
  readonly kind: 'subtotal'
  readonly key: StatementSubtotalKey
}

export type StatementLine = StatementBlockLine | StatementSubtotalLine

/**
 * A row of the "Lançamentos deste mês" table, always showing Pago and Previsto
 * together regardless of the cascade's filter (files_design/03 "DRE").
 *
 * `name` is derived, not a field of the Lançamento: it is the category name for
 * a despesa/receita, the Rótulo for an IR, the sub-tipo for a pró-labore
 * (files_design/03: "a Categoria já identifica o lançamento").
 */
export interface IncomeStatementRow {
  readonly source: IncomeStatementRowSource
  readonly name: string
  /**
   * PF or PJ — files_design/07 "Hierarquia de cor": "Etiqueta de croma baixo
   * ao lado do nome do lançamento", a confirmed change over the wireframe
   * (docs 01-03) per docs/PERGUNTAS-EM-ABERTO.md P32 (doc07 wins on visual
   * layer, ADR-0015 §1). For a despesa/receita/IR this is the entry's own
   * `entity`; for pró-labore/distribuição — which carry no `entity` field
   * because the same entry is PF revenue or PJ expense depending on who is
   * looking — it is the `view` the row was computed under (see `entityOf`).
   */
  readonly entity: Entity
  /**
   * The row's own Categoria, or `null` for pró-labore/distribuição — those
   * carry a role, not a `categoryId` (`income-statement.ts` `blockForRole`).
   *
   * Present so a reader can identify a category WITHOUT matching its `name`:
   * the name is free text the person edits ("Editar" exists on every category,
   * Figma 44:2), while the id is stable — `renameCategory` only touches `name`
   * (chart-of-accounts/rules.ts). Measured before this field existed: renaming
   * "Aluguel recebido" made `passiveIncomeCoverage` fall from 50% to 0%, with
   * no error and no warning (P22).
   */
  readonly categoryId: CategoryId | null
  readonly blockId: BlockId
  readonly blockName: string
  readonly status: EntryStatus
  readonly amount: Cents
  /** A "Descrição" do lançamento, quando tem uma (2026-09-29). */
  readonly description?: string | null
  /**
   * The Lançamento is a month of a série (2026-10-01): its "Descartar" offers
   * "Encerrar a recorrência também". Absent when it is not.
   */
  readonly recurring?: boolean
  /** The despesa is marked "Cartão de crédito" (ADR-0021). Absent when it is not. */
  readonly isCreditCard?: boolean
  /**
   * The Lançamento's own date (payment, or planned for a Previsto). Absent on
   * a parcela de Passivo. The DRE's category list showed "—" for every
   * Lançamento that did not come from the bank, recurring ones included,
   * because it only knew the bank's date (owner's screenshot, 2026-10-06).
   */
  readonly date?: IsoDate
  /** Ocultada na simulação (2026-10-01): fora da cascata, listada para voltar. */
  readonly hidden?: boolean
  /** Mês "a definir" ainda em branco (2026-10-01): `amount` é zero e a tela diz "A definir". */
  readonly amountToBeDefined?: boolean
  /**
   * (+) entrada ou (−) saída, pelo efeito no lucro nesta visão (2026-10-01): o
   * pró-labore entra na PF e sai da PJ, a parcela de Passivo sempre sai.
   */
  readonly flow: 'In' | 'Out'
}

/**
 * A row is normally a Lançamento, but the table also lists liability
 * installments — a future month "só tem lançamentos com Status = Previsto
 * (gerados por recorrência e parcelas de passivo)", and Figma 11:2 shows
 * "Financiamento apartamento, parcela 13" as a row (nó `235:64`).
 *
 * The Installment variant carries its `liabilityId` because the row's two
 * actions need it: `235:72` "Marcar Pago" posts to
 * `/installments/{id}/payment` and then invalidates the liability's caches,
 * and `235:74` "Editar" navigates to Detalhe do Passivo — a parcela is edited
 * there, never on the Novo Lançamento form (Figma 91:2). An installment id
 * alone reaches neither.
 *
 * A parcela CONTA no DRE, em Despesas Administrativas, pelo valor cheio — e
 * não vira Lançamento (P6, produto, 2026-09-08). Ela entra como parcela, por
 * `IncomeStatementInput.installments`, e é por isso que esta variante
 * `Installment` existe. A evidência foi a planilha de referência lida célula a
 * célula: em JUN, JUL e AGO de 2026 a linha "(-) Financiamento imóvel/veículo"
 * está preenchida todo mês no bloco 4, e "(-) Juros do financiamento" está
 * zerada todo mês — a referência lança a parcela inteira como despesa
 * administrativa e não separa juros.
 */
export type IncomeStatementRowSource =
  | { readonly kind: 'Entry'; readonly entryId: EntryId }
  /**
   * The Previsto of a recurrence — an occurrence, not a Lançamento (ADR-0019).
   * Its actions go to the occurrence routes; sent as `Entry` with a synthetic
   * id, "Editar" opened a Lançamento that does not exist (2026-09-29).
   */
  | {
      readonly kind: 'Occurrence'
      readonly occurrenceId: OccurrenceId
      readonly recurrenceId: RecurrenceId
    }
  | {
      readonly kind: 'Installment'
      readonly installmentId: InstallmentId
      readonly liabilityId: LiabilityId
    }

export interface IncomeStatement {
  readonly month: Month
  readonly view: View
  /**
   * The Pago/Previsto toggle drives the whole cascade. Default: Pago in the
   * current or a past month, Previsto in a future one (files_design/03).
   */
  readonly statusFilter: EntryStatus
  /** "Ver previsão do mês": a cascata soma pago e previsto (2026-09-23). */
  readonly forecast: boolean
  readonly lines: readonly StatementLine[]
  /**
   * Receita Líquida − CSV: o Lucro Bruto de verdade. Fica aqui e NÃO como linha
   * da cascata porque o produto fechou em 13 linhas de propósito (a planilha de
   * referência tem dois subtotais a mais, RECEITA LÍQUIDA e EBT, e o design
   * comprimiu os dois) — mas o indicador "Margem bruta" precisa do número, e
   * indicador não exige linha. P44, decisão de 2026-09-08.
   */
  readonly grossProfit: Cents
  /** The bottom line, repeated here because the Destinar o Lucro card reads it. */
  readonly netProfit: Cents
  readonly rows: readonly IncomeStatementRow[]
}

/* -------------------------------------------------------------------------
 * Balanço Patrimonial — files_design/01 §8.2, PRD "Balanço Patrimonial"
 * ---------------------------------------------------------------------- */

/** What a balance sheet line points at, so the screen can drill into it. */
export type BalanceSheetSource =
  | { readonly kind: 'BankAccount'; readonly bankAccountId: BankAccountId }
  | { readonly kind: 'Investment'; readonly investmentId: InvestmentId }
  | { readonly kind: 'TangibleAsset'; readonly tangibleAssetId: TangibleAssetId }
  | { readonly kind: 'Liability'; readonly liabilityId: LiabilityId }

export interface BalanceSheetItem {
  readonly source: BalanceSheetSource
  /** pt-BR, the name the person gave the account, investment, bem or passivo. */
  readonly label: string
  /**
   * The PF/PJ etiqueta the screen prints under the name. It travels with the
   * item because "Detalhe do Bloco" needs it: the Wireframe draws "PF" under
   * "Tesouro Direto" and under "Ações XP" (docs/figma/frames/345-252, nós
   * 189:35 e 189:40), and the aggregated Investimentos block mixes items the
   * `view` filter alone can no longer tell apart.
   */
  readonly entity: Entity
  readonly amount: Cents
}

/** A group of the balance sheet: its total and what makes it up. */
export interface BalanceSheetGroup {
  readonly total: Cents
  readonly items: readonly BalanceSheetItem[]
}

/**
 * A photo of the present moment, never a historical series — the screen has no
 * month selector (files_design/03 "Relatórios — parâmetros comuns").
 */
export interface BalanceSheet {
  readonly view: View
  /** The day the photo was taken; the screen prints "posição em 20/07/2026". */
  readonly asOf: IsoDate
  readonly currentAssets: BalanceSheetGroup
  readonly nonCurrentAssets: BalanceSheetGroup
  readonly currentLiabilities: BalanceSheetGroup
  readonly nonCurrentLiabilities: BalanceSheetGroup
  readonly totalAssets: Cents
  readonly totalLiabilities: Cents
  /** Patrimônio Líquido = total de ativos − total de passivos (PRD). */
  readonly netWorth: Cents
}

/* -------------------------------------------------------------------------
 * Evolução Mensal — files_design/01 §8.3, Figma 23:2
 * ---------------------------------------------------------------------- */

/** One column of the table and one point of the chart. */
export interface MonthlyTrendPoint {
  readonly month: Month
  readonly revenue: Cents
  readonly ebitda: Cents
  /** Equal to EBITDA every month while D&A is zero (PRD §5); kept for fidelity. */
  readonly ebit: Cents
  readonly netProfit: Cents
  readonly netWorth: Cents
  /**
   * `true` só onde NÃO há retrato mensal do PL até aquele mês — e aí o número é
   * a caminhada para trás, `PL(mês) = PL(mês+1) − LucroLíquido(mês+1)`.
   *
   * ADR-0016: essa soma assume que só o Lucro Líquido move o patrimônio, e a
   * medição de 2026-09-09 mostrou que isso é falso por construção — saldo de
   * conta e valor de investimento só mudam quando a pessoa os edita, e pagar um
   * Lançamento não os move. Por isso o PL passado passou a ser GRAVADO
   * (`net_worth_snapshots`) em vez de derivado. Meses anteriores à tabela não
   * têm retrato e continuam na reconstrução — é o que este campo marca.
   *
   * `false` também no mês `until`, cujo `netWorth` é o Balanço carregado agora.
   */
  readonly netWorthIsReconstructed: boolean
}

export const MONTHLY_TREND_RANGES = ['LastSixMonths', 'LastYear'] as const
export type MonthlyTrendRange = (typeof MONTHLY_TREND_RANGES)[number]

export const LABEL_MONTHLY_TREND_RANGE: Record<MonthlyTrendRange, string> = {
  LastSixMonths: 'Últimos 6 meses',
  LastYear: 'Último ano',
}

export interface MonthlyTrend {
  readonly view: View
  readonly range: MonthlyTrendRange
  /**
   * Only the months that actually have data since the person started using the
   * app — empty months are not filled in (files_design/01 §8.3).
   */
  readonly points: readonly MonthlyTrendPoint[]
}

/* -------------------------------------------------------------------------
 * Indicadores Financeiros — files_design/01 §8.4, Figma 25:2
 * ---------------------------------------------------------------------- */

export const INDICATOR_FAMILIES = [
  'Profitability',
  'Liquidity',
  'Leverage',
  'NetWorthGrowth',
  'FinancialQualityOfLife',
] as const
export type IndicatorFamily = (typeof INDICATOR_FAMILIES)[number]

export const LABEL_INDICATOR_FAMILY: Record<IndicatorFamily, string> = {
  Profitability: 'Rentabilidade',
  Liquidity: 'Liquidez',
  Leverage: 'Endividamento',
  NetWorthGrowth: 'Crescimento Patrimonial',
  FinancialQualityOfLife: 'Qualidade de Vida Financeira',
}

/** `x` is a ratio ("7,0"), `months` a number of months ("4,2 meses"). */
export const INDICATOR_UNITS = ['%', 'x', 'months', 'BRL'] as const
export type IndicatorUnit = (typeof INDICATOR_UNITS)[number]

export const INDICATOR_KEYS = [
  'grossMargin',
  'ebitdaMargin',
  'ebitMargin',
  'netMargin',
  'returnOnEquity',
  'savingsRate',
  'currentRatio',
  'generalLiquidityRatio',
  'debtRatio',
  'debtToEquity',
  'incomeCommitment',
  'netWorthGrowth',
  'investmentGrowth',
  'monthlyCostOfLiving',
  'emergencyReserve',
  'passiveIncomeCoverage',
  'discretionaryOverFreeCashFlow',
  'contributionEfficiency',
] as const
export type IndicatorKey = (typeof INDICATOR_KEYS)[number]

export interface IndicatorDefinition {
  readonly key: IndicatorKey
  readonly family: IndicatorFamily
  /** pt-BR, word for word as printed on the screen (Figma 25:2). */
  readonly label: string
  readonly unit: IndicatorUnit
  /**
   * A frase do "i" de ajuda, na tela. Diz o que o número É — a fórmula em
   * português —, nunca se ele é bom.
   *
   * Decidido em 2026-09-11 (files_design/05 §7): a sugestão pedia faixas de
   * referência ("liquidez saudável é acima de 1,5"), e o PRD proíbe faixa e cor
   * de julgamento. O limiar é conteúdo financeiro, varia por literatura e
   * perfil, e vários destes 18 não têm referência universal possível — "Custo de
   * vida mensal" é um valor em reais. O que a pessoa precisava, porém, era real:
   * ver o número sem saber o que ele é. Explicar resolve isso sem sentenciar.
   */
  readonly help: string
}

/**
 * The 18 indicators of the five PRD families, in screen order. The formulas are
 * not here — this is the list, its labels and its units.
 */
export const INDICATOR_DEFINITIONS: readonly IndicatorDefinition[] = [
  {
    key: 'grossMargin',
    family: 'Profitability',
    label: 'Margem bruta',
    unit: '%',
    help: 'Quanto sobra de cada R$ 100 de receita depois de pagar os custos diretos do serviço.',
  },
  {
    key: 'ebitdaMargin',
    family: 'Profitability',
    label: 'Margem EBITDA',
    unit: '%',
    help: 'Quanto sobra de cada R$ 100 de receita depois dos custos e das despesas operacionais.',
  },
  // Coincides with the EBITDA margin while D&A is zero (PRD §5).
  {
    key: 'ebitMargin',
    family: 'Profitability',
    label: 'Margem EBIT',
    unit: '%',
    help: 'Igual à margem EBITDA enquanto não há depreciação nem amortização — por isso as duas coincidem todo mês.',
  },
  {
    key: 'netMargin',
    family: 'Profitability',
    label: 'Margem líquida',
    unit: '%',
    help: 'Quanto sobra de cada R$ 100 de receita depois de tudo, inclusive impostos e resultado não operacional.',
  },
  {
    key: 'returnOnEquity',
    family: 'Profitability',
    label: 'ROE',
    unit: '%',
    help: 'Quanto o resultado do mês representa sobre o patrimônio líquido que você já tem.',
  },
  {
    key: 'savingsRate',
    family: 'Profitability',
    label: 'Taxa de poupança',
    unit: '%',
    help: 'Quanto do que entrou, já descontadas as deduções, sobrou no fim do mês.',
  },
  {
    key: 'currentRatio',
    family: 'Liquidity',
    label: 'Liquidez corrente',
    unit: 'x',
    help: 'Quantas vezes o que você tem disponível cobre o que você deve no curto prazo.',
  },
  {
    key: 'generalLiquidityRatio',
    family: 'Liquidity',
    label: 'Liquidez geral',
    unit: 'x',
    help: 'Quantas vezes tudo que você tem cobre tudo que você deve, sem separar por prazo.',
  },
  {
    key: 'debtRatio',
    family: 'Leverage',
    label: 'Grau de endividamento',
    unit: '%',
    help: 'Que parte do que você tem está comprometida com dívida.',
  },
  {
    key: 'debtToEquity',
    family: 'Leverage',
    label: 'Endividamento sobre PL',
    unit: '%',
    help: 'O tamanho da sua dívida comparado ao seu patrimônio líquido.',
  },
  {
    key: 'incomeCommitment',
    family: 'Leverage',
    label: 'Comprometimento da renda',
    unit: '%',
    help: 'Quanto da receita do mês vai para as parcelas de dívida vencendo nesse mês.',
  },
  {
    key: 'netWorthGrowth',
    family: 'NetWorthGrowth',
    label: 'Crescimento do PL (mês)',
    unit: '%',
    help: 'Quanto o resultado do mês representa sobre o patrimônio do mês anterior.',
  },
  {
    key: 'investmentGrowth',
    family: 'NetWorthGrowth',
    label: 'Crescimento dos investimentos (mês)',
    unit: '%',
    help: 'Quanto você aportou no mês comparado ao que já tinha investido. Não inclui rendimento: o produto não reavalia investimento.',
  },
  {
    key: 'monthlyCostOfLiving',
    family: 'FinancialQualityOfLife',
    label: 'Custo de vida mensal',
    unit: 'BRL',
    help: 'A soma das suas despesas do mês.',
  },
  {
    key: 'emergencyReserve',
    family: 'FinancialQualityOfLife',
    label: 'Reserva de emergência',
    unit: 'months',
    help: 'Quantos meses do seu custo de vida o dinheiro disponível cobre hoje.',
  },
  {
    key: 'passiveIncomeCoverage',
    family: 'FinancialQualityOfLife',
    label: 'Cobertura por renda passiva',
    unit: '%',
    help: 'Quanto do seu custo de vida é coberto por aluguel recebido e rendimentos de investimento.',
  },
  {
    key: 'discretionaryOverFreeCashFlow',
    family: 'FinancialQualityOfLife',
    label: 'Consumo livre / FCL',
    unit: '%',
    help: 'Que parte do que sobrou no mês foi para o Consumo Livre.',
  },
  {
    key: 'contributionEfficiency',
    family: 'FinancialQualityOfLife',
    label: 'Eficiência de aporte',
    unit: '%',
    help: 'Que parte do que sobrou no mês virou aporte em investimento.',
  },
]

interface IndicatorBase {
  readonly key: IndicatorKey
  readonly label: string
}

/**
 * A computed indicator. `value` is `null` whenever the denominator is zero —
 * the screen then shows a dash, because "0%" and "NaN%" are two different lies
 * (same contract as `percentOf` in core/money).
 */
export type Indicator =
  | (IndicatorBase & {
      readonly unit: Exclude<IndicatorUnit, 'BRL'>
      readonly value: number | null
    })
  // A monetary indicator carries `Cents`, like every other amount in the domain.
  | (IndicatorBase & { readonly unit: 'BRL'; readonly value: Cents | null })

export interface FinancialIndicators {
  readonly month: Month
  readonly view: View
  readonly profitability: readonly Indicator[]
  readonly liquidity: readonly Indicator[]
  readonly leverage: readonly Indicator[]
  readonly netWorthGrowth: readonly Indicator[]
  readonly financialQualityOfLife: readonly Indicator[]
}
