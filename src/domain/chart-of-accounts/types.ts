/**
 * Plano de Contas — the 10 statement blocks and the categories inside them.
 *
 * Os 10 blocos são fixos (files_design/01 §3.1: "Blocos são fixos; só as
 * categorias dentro deles são editáveis") — e fixos de verdade, não
 * provisoriamente: o PRD v7 §1 e §9.5 fecharam o H10 por decisão de produto,
 * revertendo a premissa da v6 de que a cascata viraria um motor configurável.
 * Não há ADR de motor por vir.
 *
 * Ainda assim eles são modelados como DADO, e não como enum ramificado pelo
 * código, e a razão sobrevive ao fechamento do H10: toda regra lê a lista, de
 * modo que mudar a estrutura é mexer em `DEFAULT_BLOCKS` e não no motor de
 * cálculo. Isso vale por si — é o que mantém a cascata testável com um plano
 * sintético — e não por antecipar configuração que o MVP decidiu não ter.
 */

import { asId, type BlockId, type CategoryId, type Classification } from '@/domain/core'

/**
 * How a block enters the income-statement cascade. The strings mirror what the
 * DRE screen prints in front of each line (Figma 11:2): `(-) Deduções da
 * Receita`, `(+/–) Resultado Financeiro`, `Receita Bruta` with no prefix.
 *
 * `Signed` is not the same as `Add`: the person reads "(+/–)" as "this line can
 * go either way", and the block's own amount carries the sign.
 */
export const CASCADE_EFFECTS = ['Add', 'Subtract', 'Signed', 'None'] as const
export type CascadeEffect = (typeof CASCADE_EFFECTS)[number]

/** The prefix the DRE prints before a block's name — Figma 11:2. */
export const LABEL_CASCADE_PREFIX: Record<CascadeEffect, string> = {
  Add: '',
  Subtract: '(-)',
  Signed: '(+/–)',
  None: '',
}

export interface StatementBlock {
  readonly id: BlockId
  /** pt-BR, as printed on Plano de Contas (Figma 331:2) and in the PRD. */
  readonly name: string
  /** 1..10 — the order the person sees, and the order of the cascade. */
  readonly order: number
  readonly effect: CascadeEffect
  /**
   * Block 10 sits below the Lucro Líquido line: it is an appropriation of a
   * profit already computed, so it never reduces the operating result
   * (PRD §1, "Nota intercompany"). Kept as its own field rather than derived
   * from `effect === 'None'` porque são dois conceitos diferentes: "não entra
   * na cascata" e "fica abaixo da linha do Lucro Líquido" coincidem hoje no
   * bloco 10, e derivar um do outro amarraria os dois para sempre.
   */
  readonly belowTheLine: boolean
  /**
   * D&A is read-only: it has no categories and is always zero in the MVP
   * (PRD §5, Figma 51:32 "Sem botão de criar categoria e sem Editar/Descartar").
   */
  readonly acceptsUserCategories: boolean
  /**
   * Shorter label used ON THE DRE CASCADE LINE, and nowhere else, when it
   * differs from `name` — src/domain/GLOSSARY.md: «"D&A" na cascata vs. o nome
   * completo no Plano de Contas». Measured on the literal frame text: the DRE
   * (Figma 11:2, and "Desktop — DRE (claro)" on the Mockup page) prints "D&A",
   * while all four Plano de Contas frames and the Onboarding 1 one print
   * "Depreciação & Amortização (D&A)".
   *
   * D&A is the only block that needs it. A screen that is not the cascade must
   * read `name`: `statementLabel ?? name` looks harmless and is not — it made
   * the Plano de Contas print "6. D&A" for months.
   */
  readonly statementLabel: string | null
}

/**
 * Stable ids for the 10 reference blocks, keyed by the English names the
 * glossary already locked for the report lines. Rules reference blocks through
 * this record instead of hard-coding a slug.
 */
export const BLOCK_IDS = {
  grossRevenue: asId<BlockId>('receita-bruta'),
  revenueDeductions: asId<BlockId>('deducoes-da-receita'),
  costOfServices: asId<BlockId>('custo-dos-servicos'),
  administrativeExpenses: asId<BlockId>('despesas-administrativas'),
  personalExpenses: asId<BlockId>('despesas-pessoais'),
  depreciationAndAmortization: asId<BlockId>('depreciacao-e-amortizacao'),
  nonOperatingResult: asId<BlockId>('resultado-nao-operacional'),
  financialResult: asId<BlockId>('resultado-financeiro'),
  profitTaxes: asId<BlockId>('impostos-sobre-o-lucro'),
  profitAllocation: asId<BlockId>('destinacao-do-lucro'),
} as const

/** PRD "Plano de contas de referência" — the initial, editable model. */
export const DEFAULT_BLOCKS: readonly StatementBlock[] = [
  {
    id: BLOCK_IDS.grossRevenue,
    name: 'Receita Bruta',
    order: 1,
    effect: 'Add',
    belowTheLine: false,
    acceptsUserCategories: true,
    statementLabel: null,
  },
  {
    id: BLOCK_IDS.revenueDeductions,
    name: 'Deduções da Receita',
    order: 2,
    effect: 'Subtract',
    belowTheLine: false,
    acceptsUserCategories: true,
    statementLabel: null,
  },
  {
    id: BLOCK_IDS.costOfServices,
    // "(CSV)" é abreviação de PROSA do PRD (§361, e a tabela de atores §110);
    // nenhum frame do Figma imprime a sigla — nem a cascata do DRE, nem as 4
    // telas de Plano de Contas, nem o Onboarding 1. Os dois rótulos coincidem,
    // então este bloco não precisa de `statementLabel`.
    name: 'Custo dos Serviços/Produtos',
    order: 3,
    effect: 'Subtract',
    belowTheLine: false,
    acceptsUserCategories: true,
    statementLabel: null,
  },
  {
    id: BLOCK_IDS.administrativeExpenses,
    name: 'Despesas Administrativas',
    order: 4,
    effect: 'Subtract',
    belowTheLine: false,
    acceptsUserCategories: true,
    statementLabel: null,
  },
  {
    id: BLOCK_IDS.personalExpenses,
    name: 'Despesas Pessoais/Consumo',
    order: 5,
    effect: 'Subtract',
    belowTheLine: false,
    acceptsUserCategories: true,
    statementLabel: null,
  },
  {
    id: BLOCK_IDS.depreciationAndAmortization,
    name: 'Depreciação & Amortização (D&A)',
    order: 6,
    effect: 'Subtract',
    belowTheLine: false,
    // Always zero in the MVP, and the only block with no categories at all.
    acceptsUserCategories: false,
    statementLabel: 'D&A',
  },
  {
    id: BLOCK_IDS.nonOperatingResult,
    name: 'Resultado Não Operacional',
    order: 7,
    effect: 'Signed',
    belowTheLine: false,
    acceptsUserCategories: true,
    statementLabel: null,
  },
  {
    id: BLOCK_IDS.financialResult,
    name: 'Resultado Financeiro',
    order: 8,
    effect: 'Signed',
    belowTheLine: false,
    acceptsUserCategories: true,
    statementLabel: null,
  },
  {
    id: BLOCK_IDS.profitTaxes,
    name: 'Impostos sobre o Lucro',
    order: 9,
    effect: 'Subtract',
    belowTheLine: false,
    acceptsUserCategories: true,
    statementLabel: null,
  },
  {
    id: BLOCK_IDS.profitAllocation,
    name: 'Destinação do Lucro',
    order: 10,
    effect: 'None',
    belowTheLine: true,
    acceptsUserCategories: true,
    statementLabel: null,
  },
]

export interface Category {
  readonly id: CategoryId
  readonly blockId: BlockId
  /** pt-BR, free text typed by the person. */
  readonly name: string
  /**
   * A system category is created by the product and cannot be renamed or
   * archived: "Consumo Livre" is fixed inside Despesas Pessoais because the
   * widget always posts to it (files_design/03 "Consumo Livre — widget").
   */
  readonly isSystem: boolean
  /**
   * Pre-selects Classificação on the Novo Lançamento form ("sugerida a partir
   * da categoria; editável" — files_design/03 "Aba Despesa"). `null` means the
   * category carries no suggestion and the form keeps its own default.
   *
   * P8, decidido em 2026-09-09: **só sugere onde o conceito se aplica.**
   * Circulante / não circulante é vocabulário de INSTRUMENTO — ativo ou passivo
   * com um horizonte —, não de gasto: "Alimentação" não é nem um nem outro, e
   * uma sugestão arbitrária ensina a pessoa a ignorar o campo. Por isso as
   * categorias de despesa sugerem `Current` (o gasto do mês é do mês), a de
   * financiamento sugere `NonCurrent` (PRD §Balanço, "saldo devedor de
   * financiamento"), e as de RECEITA e DEDUÇÃO seguem `null`: receita não é
   * ativo nem passivo, e o campo não tem o que dizer sobre ela.
   */
  readonly suggestedClassification: Classification | null
  /**
   * There is no delete: an unused category is archived, never removed
   * (files_design/01 §3.1; Event Storming Fluxo A "Categoria arquivada").
   */
  readonly archived: boolean
  /**
   * Counts toward "Cobertura por renda passiva" (files_design/08 §10).
   *
   * Product decision of 2026-09-08, answering the open half of P22: before it,
   * the indicator only ever saw the two reference categories, so a category
   * the person created for passive income ("Dividendos XP", a second rented
   * property) was silently left out of the ratio. A flag on the category is
   * what lets the person say so, instead of the domain guessing from a name.
   *
   * Ships `true` on "Aluguel recebido" and "Dividendos/Rendimentos de
   * investimentos externos" (the two the PRD's reference chart names), `false`
   * everywhere else.
   */
  readonly isPassiveIncome: boolean
}

/**
 * A categoria em que o Ganho/Perda de uma venda de Bem Material é reconhecido
 * (files_design/01 §11, frame `99:56`: "Lançado automaticamente em Resultado
 * Não Operacional"). Nomeada aqui porque a rota de venda precisa apontar para
 * ela sem re-derivar o id por busca de nome.
 */
export const GAIN_ON_ASSET_SALE_CATEGORY_ID = asId<CategoryId>('ganho-perda-venda-de-ativo')

/** The fixed "Consumo Livre" category every discretionary expense posts to. */
export const DISCRETIONARY_CATEGORY_ID = asId<CategoryId>('consumo-livre')

/**
 * "A categorizar" — where what the bank reports lands until the person picks
 * the category (PRD v7.46, decisão do dono de 2026-09-29: "deixa que eu
 * categorizo, sem de-para"). Two, because a Lançamento has to sit in a block
 * for the DRE to close against the bank: money out waits in Despesas
 * Pessoais/Consumo, money in waits in Receita Bruta. They are system
 * categories, like Consumo Livre, and are seeded apart from the reference
 * chart (`UNCATEGORIZED_CATEGORIES`) so a person who onboarded before them
 * still gets them.
 */
export const UNCATEGORIZED_EXPENSE_CATEGORY_ID = asId<CategoryId>('a-categorizar')
export const UNCATEGORIZED_REVENUE_CATEGORY_ID = asId<CategoryId>('a-categorizar-receita')

/**
 * P8: a sugestão sai do BLOCO, não de uma tabela categoria a categoria — os três
 * blocos de despesa são o que "acontece e se paga no mês", e é isso que
 * Circulante quer dizer. A única exceção nomeada por fonte é o financiamento, e
 * ela está logo abaixo, na própria linha da categoria.
 */
const EXPENSE_BLOCKS: readonly BlockId[] = [
  BLOCK_IDS.costOfServices,
  BLOCK_IDS.administrativeExpenses,
  BLOCK_IDS.personalExpenses,
]

function category(
  id: string,
  blockId: BlockId,
  name: string,
  isSystem = false,
  isPassiveIncome = false,
  suggestedClassification: Classification | null = EXPENSE_BLOCKS.includes(blockId)
    ? 'Current'
    : null,
): Category {
  return {
    id: asId<CategoryId>(id),
    blockId,
    name,
    isSystem,
    suggestedClassification,
    archived: false,
    isPassiveIncome,
  }
}

/**
 * The example categories of each block, transcribed from the PRD "Plano de
 * contas de referência". They are a starting point the person edits, not a
 * closed list (PRD §1: "modelo inicial editável").
 *
 * Block 6 (D&A) has no categories on purpose — Figma 51:32.
 */
export const DEFAULT_CATEGORIES: readonly Category[] = [
  category('salario-pro-labore', BLOCK_IDS.grossRevenue, 'Salário/Pró-labore'),
  // `isPassiveIncome`: as duas categorias de renda passiva do plano de
  // contas de referência do PRD (bloco 1). Ver `Category.isPassiveIncome`.
  category('aluguel-recebido', BLOCK_IDS.grossRevenue, 'Aluguel recebido', false, true),
  category(
    'dividendos-rendimentos',
    BLOCK_IDS.grossRevenue,
    // Not intercompany: external dividends are ordinary revenue and are never
    // eliminated in the consolidated view (PRD §1, "Nota intercompany").
    'Dividendos/Rendimentos de investimentos externos',
    false,
    true,
  ),
  category('freelance-renda-extra', BLOCK_IDS.grossRevenue, 'Freelance/Renda extra'),
  category('outras-receitas-operacionais', BLOCK_IDS.grossRevenue, 'Outras receitas operacionais'),

  category('das-simples', BLOCK_IDS.revenueDeductions, 'DAS Simples'),
  category('darf-unificado', BLOCK_IDS.revenueDeductions, 'DARF Unificado'),
  category('taxa-fiscalizacao-estab', BLOCK_IDS.revenueDeductions, 'Taxa Fiscalização Estab.'),
  category('outras-deducoes', BLOCK_IDS.revenueDeductions, 'Outras deduções'),

  category('assinaturas-e-ferramentas', BLOCK_IDS.costOfServices, 'Assinaturas e ferramentas'),
  category('racao-pet', BLOCK_IDS.costOfServices, 'Ração/pet'),
  category('academia', BLOCK_IDS.costOfServices, 'Academia'),
  category('contador-assessoria', BLOCK_IDS.costOfServices, 'Contador/assessoria'),
  category('infraestrutura-internet', BLOCK_IDS.costOfServices, 'Infraestrutura/internet'),
  category('outros-custos-diretos', BLOCK_IDS.costOfServices, 'Outros custos diretos'),

  category('aluguel-moradia', BLOCK_IDS.administrativeExpenses, 'Aluguel moradia'),
  // A única categoria de despesa que nomeia um instrumento de longo prazo —
  // PRD §Balanço, "Passivo não circulante — saldo devedor de financiamento".
  category(
    'financiamento-imovel-veiculo',
    BLOCK_IDS.administrativeExpenses,
    'Financiamento imóvel/veículo',
    false,
    false,
    'NonCurrent',
  ),
  category('plano-de-saude', BLOCK_IDS.administrativeExpenses, 'Plano de saúde'),
  category('educacao', BLOCK_IDS.administrativeExpenses, 'Educação'),
  category('agua', BLOCK_IDS.administrativeExpenses, 'Água'),
  category('luz', BLOCK_IDS.administrativeExpenses, 'Luz'),
  category(
    'outras-despesas-administrativas',
    BLOCK_IDS.administrativeExpenses,
    'Outras despesas administrativas',
  ),

  category('alimentacao', BLOCK_IDS.personalExpenses, 'Alimentação'),
  category('transporte', BLOCK_IDS.personalExpenses, 'Transporte'),
  category('lazer-entretenimento', BLOCK_IDS.personalExpenses, 'Lazer/Entretenimento'),
  category('vestuario', BLOCK_IDS.personalExpenses, 'Vestuário'),
  category('outras-despesas-pessoais', BLOCK_IDS.personalExpenses, 'Outras despesas pessoais'),
  // "Consumo Livre" com L maiúsculo é o que o Figma escreve, medido, não o que
  // o glossário assumiu: 55 nós do Wireframe (21 frames) e 96 do Mockup `552:2`
  // — card `193:5`, treemap `198:3`, Histórico `9:67`/`9:112`, modais `192:3`,
  // `192:16`, `192:19`. O único nó em caixa baixa do arquivo inteiro é `44:78`,
  // no frame `44:2` "Onboarding 1 — bloco de categoria expandido (exemplo)",
  // sem contraparte no Mockup (que desenha esse bloco colapsado, `936:1543` e
  // `988:1995`). A lista do Plano de Contas nem imprime a categoria: `331:2` e
  // `29:2` só trazem a legenda em prosa `331:103`/`51:16` ("...vestuário,
  // consumo livre..."), que é capitalização de frase. Placar: 151 × 1.
  // "Consumo livre / FCL" (`25:113`; Mockup `858:1284`/`858:1403`) é outra
  // string — rótulo de Indicadores, em `src/domain/reports/types.ts`, e
  // continua minúsculo de propósito.
  category(DISCRETIONARY_CATEGORY_ID, BLOCK_IDS.personalExpenses, 'Consumo Livre', true),

  category(
    'ganho-perda-venda-de-ativo',
    BLOCK_IDS.nonOperatingResult,
    'Ganho/perda na venda de ativo',
  ),
  category(
    'outras-nao-operacionais',
    BLOCK_IDS.nonOperatingResult,
    'Outras receitas/despesas não operacionais',
  ),

  category(
    'juros-financiamento-cartao-emprestimos',
    BLOCK_IDS.financialResult,
    'Juros de financiamento/cartão/empréstimos',
  ),
  category('rendimento-de-caixa-conta', BLOCK_IDS.financialResult, 'Rendimento de caixa/conta'),

  category('ir', BLOCK_IDS.profitTaxes, 'IR'),
  category('outros-impostos-sobre-lucro', BLOCK_IDS.profitTaxes, 'Outros impostos sobre lucro'),

  category('aporte-em-investimentos', BLOCK_IDS.profitAllocation, 'Aporte em investimentos'),
  category(
    'reinvestimento-de-dividendos',
    BLOCK_IDS.profitAllocation,
    'Reinvestimento de dividendos',
  ),
  category('consumo-extraordinario', BLOCK_IDS.profitAllocation, 'Consumo extraordinário'),
  category('reserva-em-caixa', BLOCK_IDS.profitAllocation, 'Reserva em caixa'),
  category(
    'distribuicao-de-lucro-da-pj',
    BLOCK_IDS.profitAllocation,
    'Distribuição de lucro da PJ',
  ),
]

export const UNCATEGORIZED_CATEGORIES: readonly Category[] = [
  category(UNCATEGORIZED_EXPENSE_CATEGORY_ID, BLOCK_IDS.personalExpenses, 'A categorizar', true),
  category(UNCATEGORIZED_REVENUE_CATEGORY_ID, BLOCK_IDS.grossRevenue, 'A categorizar', true),
]

export function isUncategorized(categoryId: string): boolean {
  return (
    categoryId === UNCATEGORIZED_EXPENSE_CATEGORY_ID ||
    categoryId === UNCATEGORIZED_REVENUE_CATEGORY_ID
  )
}

/** The whole editable chart: blocks plus the categories that live inside them. */
export interface ChartOfAccounts {
  readonly blocks: readonly StatementBlock[]
  readonly categories: readonly Category[]
}

export const DEFAULT_CHART_OF_ACCOUNTS: ChartOfAccounts = {
  blocks: DEFAULT_BLOCKS,
  categories: DEFAULT_CATEGORIES,
}
