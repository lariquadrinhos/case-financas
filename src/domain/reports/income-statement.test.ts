import { describe, expect, it } from 'vitest'
import { asId, cents, isoDate, month, ZERO } from '@/domain/core'
import type { BankAccountId, CategoryId, Cents, EntryId } from '@/domain/core'
import {
  BLOCK_IDS,
  UNCATEGORIZED_CATEGORIES,
  UNCATEGORIZED_EXPENSE_CATEGORY_ID,
  type ChartOfAccounts,
} from '@/domain/chart-of-accounts/types'
import { initializeChartOfAccounts } from '@/domain/chart-of-accounts/rules'
import type { Entry } from '@/domain/entries'
import type { Installment, Liability } from '@/domain/assets'
import type { InstallmentId, LiabilityId } from '@/domain/core'
import {
  computeIncomeStatement,
  defaultStatusFilterFor,
  hasProfitToAllocate,
} from './income-statement'
import type { IncomeStatement, StatementSubtotalKey } from './types'

const JULY = month('2026-07')
const CHART: ChartOfAccounts = initializeChartOfAccounts()

/** Picks any category that lives in the given block, so tests do not hard-code names. */
function categoryIn(blockKey: keyof typeof BLOCK_IDS): CategoryId {
  const category = CHART.categories.find((c) => c.blockId === BLOCK_IDS[blockKey])
  if (!category) throw new Error(`no default category in block ${blockKey}`)
  return category.id
}

const PF_ACCOUNT = asId<BankAccountId>('conta-pf')
const PJ_ACCOUNT = asId<BankAccountId>('conta-pj')

let sequence = 0
const nextId = () => asId<EntryId>(`entry-${(sequence += 1)}`)

function entry(partial: Partial<Entry> & Pick<Entry, 'kind' | 'amount'>): Entry {
  return {
    id: nextId(),
    date: isoDate('2026-07-15'),
    status: 'Paid',
    recurrenceId: null,
    ...partial,
  } as Entry
}

function revenue(amount: Cents, entity: 'PF' | 'PJ' = 'PJ'): Entry {
  return entry({
    kind: 'Revenue',
    amount,
    entity,
    categoryId: categoryIn('grossRevenue'),
    classification: 'Current',
    bankAccountId: entity === 'PF' ? PF_ACCOUNT : PJ_ACCOUNT,
  } as Partial<Entry> & Pick<Entry, 'kind' | 'amount'>)
}

function expense(
  amount: Cents,
  blockKey: keyof typeof BLOCK_IDS = 'administrativeExpenses',
  entity: 'PF' | 'PJ' = 'PF',
): Entry {
  return entry({
    kind: 'Expense',
    amount,
    entity,
    categoryId: categoryIn(blockKey),
    classification: 'Current',
    bankAccountId: entity === 'PF' ? PF_ACCOUNT : PJ_ACCOUNT,
  } as Partial<Entry> & Pick<Entry, 'kind' | 'amount'>)
}

function proLabore(amount: Cents): Entry {
  return entry({
    kind: 'ProLabore',
    amount,
    sourceAccountId: PJ_ACCOUNT,
    destinationAccountId: PF_ACCOUNT,
  } as Partial<Entry> & Pick<Entry, 'kind' | 'amount'>)
}

function profitDistribution(amount: Cents): Entry {
  return entry({
    kind: 'ProfitDistribution',
    amount,
    sourceAccountId: PJ_ACCOUNT,
    destinationAccountId: PF_ACCOUNT,
  } as Partial<Entry> & Pick<Entry, 'kind' | 'amount'>)
}

function statementOf(
  entries: readonly Entry[],
  view: 'Consolidated' | 'PF' | 'PJ' = 'Consolidated',
) {
  return computeIncomeStatement({ entries, chart: CHART, view, month: JULY, statusFilter: 'Paid' })
}

function subtotal(statement: IncomeStatement, key: StatementSubtotalKey): Cents {
  const line = statement.lines.find((l) => l.kind === 'subtotal' && l.key === key)
  if (!line) throw new Error(`subtotal ${key} missing from the cascade`)
  return line.amount
}

function blockAmount(statement: IncomeStatement, key: keyof typeof BLOCK_IDS): Cents {
  const line = statement.lines.find((l) => l.kind === 'block' && l.key === BLOCK_IDS[key])
  if (!line) throw new Error(`block ${key} missing from the cascade`)
  return line.amount
}

/* ------------------------------------------- files_design/01 §8.1 — cascade */

describe('computeIncomeStatement — the cascade shape', () => {
  it('always returns the 13 lines, even for a month with no entries', () => {
    // files_design/01 §15: the screen needs every line to render its empty
    // state. Returning an empty list would make the empty DRE unrenderable.
    const statement = statementOf([])
    expect(statement.lines).toHaveLength(13)
    expect(statement.netProfit).toBe(ZERO)
  })

  it('prints the lines in the reference order', () => {
    const statement = statementOf([])
    expect(statement.lines.map((l) => l.label)).toEqual([
      'Receita Bruta',
      'Deduções da Receita',
      // P44 (produto, 2026-09-08): esta linha sempre valeu Receita Bruta −
      // Deduções, que é a RECEITA LÍQUIDA da planilha de referência
      // (`=C10-C16`). O Lucro Bruto dela é outra linha, que desconta o CSV
      // (`=C17-C26`), e o produto fechou em 13 linhas de propósito — então a
      // linha ficou, com o nome certo. O Lucro Bruto de verdade continua
      // calculado, em `statement.grossProfit`, sem virar linha.
      'Receita Líquida',
      'Custo dos Serviços/Produtos',
      'Despesas Administrativas',
      'Despesas Pessoais/Consumo',
      'EBITDA',
      'D&A',
      'EBIT',
      'Resultado Não Operacional',
      'Resultado Financeiro',
      'Impostos sobre o Lucro',
      'Lucro Líquido',
    ])
  })

  it('P44 — `grossProfit` desconta o CSV, e não é o subtotal impresso', () => {
    const st = statementOf([revenue(cents(1_000_000)), expense(cents(300_000), 'costOfServices')])

    const receitaLiquida = st.lines.find((l) => l.kind === 'subtotal' && l.key === 'netRevenue')
    expect(receitaLiquida?.amount).toBe(1_000_000)
    expect(st.grossProfit).toBe(700_000)
  })

  it('prints an expense as a POSITIVE number under a subtracting block', () => {
    // Figma 11:2 shows "(-) Despesas Administrativas  R$ 5.000,00", not -5.000.
    const statement = statementOf([expense(cents(500_000))])
    expect(blockAmount(statement, 'administrativeExpenses')).toBe(500_000)
    expect(statement.netProfit).toBe(-500_000)
  })
})

describe('computeIncomeStatement — EBITDA equals EBIT (PRD §5, release criterion)', () => {
  it('holds for an empty month', () => {
    const statement = statementOf([])
    expect(subtotal(statement, 'ebitda')).toBe(subtotal(statement, 'ebit'))
  })

  it('holds for a month with revenue, expenses and intercompany movement', () => {
    const statement = statementOf(
      [revenue(cents(2_440_000)), expense(cents(520_000)), proLabore(cents(400_000))],
      'PJ',
    )
    expect(subtotal(statement, 'ebitda')).toBe(subtotal(statement, 'ebit'))
  })

  it('keeps the D&A line at zero, because it is never computed monthly', () => {
    const statement = statementOf([revenue(cents(1_000_000)), expense(cents(300_000))])
    expect(blockAmount(statement, 'depreciationAndAmortization')).toBe(ZERO)
  })
})

/* ---------------------------------------------------- ADR-0003 — 3 visões */

describe('computeIncomeStatement — the same entries give three different cascades', () => {
  // The scenario that proves the elimination: the PJ pays 4.000 of pró-labore
  // to the PF, on top of 24.400 of PJ revenue and 5.200 of PF expenses.
  const entries = [
    revenue(cents(2_440_000), 'PJ'),
    expense(cents(520_000), 'personalExpenses', 'PF'),
    proLabore(cents(400_000)),
  ]

  it('PJ sees the pró-labore as an expense that reduces its profit', () => {
    const pj = statementOf(entries, 'PJ')
    expect(blockAmount(pj, 'grossRevenue')).toBe(2_440_000)
    expect(blockAmount(pj, 'administrativeExpenses')).toBe(400_000)
    // PF's personal expense does not belong to the PJ.
    expect(blockAmount(pj, 'personalExpenses')).toBe(ZERO)
    expect(pj.netProfit).toBe(2_040_000)
  })

  it('PF sees the pró-labore as revenue', () => {
    const pf = statementOf(entries, 'PF')
    expect(blockAmount(pf, 'grossRevenue')).toBe(400_000)
    expect(blockAmount(pf, 'personalExpenses')).toBe(520_000)
    expect(pf.netProfit).toBe(-120_000)
  })

  it('Consolidated eliminates the pró-labore entirely', () => {
    const consolidated = statementOf(entries, 'Consolidated')
    // 24.400 of real revenue only — the 4.000 of pró-labore is internal.
    expect(blockAmount(consolidated, 'grossRevenue')).toBe(2_440_000)
    expect(blockAmount(consolidated, 'administrativeExpenses')).toBe(ZERO)
    expect(consolidated.netProfit).toBe(1_920_000)
  })

  it('the consolidated profit is NOT the sum of the two isolated views', () => {
    // It differs by exactly the eliminated amount. If these were equal, the
    // elimination would not be happening.
    const pj = statementOf(entries, 'PJ').netProfit
    const pf = statementOf(entries, 'PF').netProfit
    const consolidated = statementOf(entries, 'Consolidated').netProfit
    expect(pj + pf).toBe(consolidated)
    // ...and the pró-labore appears on both sides of the isolated views,
    // cancelling out — which is exactly why the sum reconciles.
    expect(consolidated).toBe(1_920_000)
  })
})

describe('computeIncomeStatement — distribuição de lucro sits below the line', () => {
  const entries = [revenue(cents(1_000_000), 'PJ'), profitDistribution(cents(300_000))]

  it('does not reduce the PJ EBIT', () => {
    const pj = statementOf(entries, 'PJ')
    // The whole point: an appropriation of profit is not an operating cost.
    expect(subtotal(pj, 'ebit')).toBe(1_000_000)
  })

  it('does not reduce the PJ net profit either, because block 10 is out of the cascade', () => {
    const pj = statementOf(entries, 'PJ')
    expect(pj.netProfit).toBe(1_000_000)
  })

  it('is revenue for the PF', () => {
    const pf = statementOf(entries, 'PF')
    expect(blockAmount(pf, 'grossRevenue')).toBe(300_000)
  })
})

/* ------------------------------------------- PRD §1 — Previsto x Pago */

describe('computeIncomeStatement — the toggle drives the whole cascade', () => {
  const entries = [
    revenue(cents(1_000_000)),
    entry({
      kind: 'Expense',
      amount: cents(400_000),
      status: 'Planned',
      entity: 'PF',
      categoryId: categoryIn('administrativeExpenses'),
      classification: 'Current',
      bankAccountId: PF_ACCOUNT,
    } as Partial<Entry> & Pick<Entry, 'kind' | 'amount'>),
  ]

  it('the Paid filter ignores the Planned expense', () => {
    const paid = computeIncomeStatement({
      entries,
      chart: CHART,
      view: 'Consolidated',
      month: JULY,
      statusFilter: 'Paid',
    })
    expect(paid.netProfit).toBe(1_000_000)
  })

  it('dono 2026-10-09 — o filtro Previsto é a previsão completa: o pago mais o previsto', () => {
    const planned = computeIncomeStatement({
      entries,
      chart: CHART,
      view: 'Consolidated',
      month: JULY,
      statusFilter: 'Planned',
    })
    // 1.000.000 já pago − 400.000 ainda previsto (era −400.000: só o previsto).
    expect(planned.netProfit).toBe(600_000)
  })
})

describe('defaultStatusFilterFor — a future month opens on Previsto', () => {
  it('uses Paid for the current and past months', () => {
    expect(defaultStatusFilterFor(month('2026-07'), month('2026-07'))).toBe('Paid')
    expect(defaultStatusFilterFor(month('2026-05'), month('2026-07'))).toBe('Paid')
  })

  it('uses Planned for a future month', () => {
    expect(defaultStatusFilterFor(month('2026-09'), month('2026-07'))).toBe('Planned')
  })
})

/* ----------------------------------------- files_design/01 §8.1 — prejuízo */

describe('hasProfitToAllocate — a loss removes the Destinar o Lucro card', () => {
  it('is false when the net profit is negative', () => {
    const statement = statementOf([expense(cents(500_000))])
    expect(statement.netProfit).toBe(-500_000)
    expect(hasProfitToAllocate(statement)).toBe(false)
  })

  it('is false when the net profit is exactly zero', () => {
    const statement = statementOf([revenue(cents(500_000)), expense(cents(500_000))])
    expect(statement.netProfit).toBe(ZERO)
    expect(hasProfitToAllocate(statement)).toBe(false)
  })

  it('is true when there is profit', () => {
    const statement = statementOf([revenue(cents(500_000))])
    expect(hasProfitToAllocate(statement)).toBe(true)
  })
})

/* --------------------------- files_design/01 §8.1 — "Lançamentos deste mês" */

describe('rows — the sheet under the cascade ignores the toggle', () => {
  const entries = [
    revenue(cents(1_000_000)),
    entry({
      kind: 'Expense',
      amount: cents(400_000),
      status: 'Planned',
      entity: 'PF',
      categoryId: categoryIn('administrativeExpenses'),
      classification: 'Current',
      bankAccountId: PF_ACCOUNT,
    } as Partial<Entry> & Pick<Entry, 'kind' | 'amount'>),
  ]

  it('lists Pago and Previsto together, whatever the cascade filter is', () => {
    const paid = computeIncomeStatement({
      entries,
      chart: CHART,
      view: 'Consolidated',
      month: JULY,
      statusFilter: 'Paid',
    })
    expect(paid.rows).toHaveLength(2)
    expect(paid.rows.map((r) => r.status).sort()).toEqual(['Paid', 'Planned'])
  })

  it('names a row after its category, because the category identifies the entry', () => {
    const paid = statementOf([expense(cents(100_000))])
    const row = paid.rows[0]
    expect(row).toBeDefined()
    expect(row?.name).not.toBe('')
    expect(row?.blockName).toBe('Despesas Administrativas')
  })

  it('still hides an eliminated entry from the sheet', () => {
    const consolidated = statementOf([proLabore(cents(400_000))], 'Consolidated')
    expect(consolidated.rows).toHaveLength(0)
  })

  /**
   * PRD §5 / §9.2 P1 — decisão de produto de 2026-09-08. O PRD dizia
   * "despesa/custo operacional" seis vezes sem nunca nomear o bloco, e a
   * planilha de referência (`docs/reference/meu-dre.xlsx`) não desempata: ela
   * é uma visão única, e o pró-labore aparece nela uma vez só, como RECEITA no
   * bloco 1 — os blocos 3 e 4 não têm nenhuma linha de pró-labore. A visão
   * isolada da PJ é do produto, não da planilha, e por isso a lacuna existia.
   *
   * Decidido Despesas Administrativas, por três fatos:
   *
   *   - o CSV da planilha só guarda ferramenta e serviço (assinaturas, streaming,
   *     academia, Contador, internet) — nenhuma linha de mão de obra;
   *   - pró-labore é remuneração do dono, não custo direto de entregar;
   *   - e o efeito na margem bruta, que é indicador entregue com visão PJ na
   *     tela: no CSV, ela passaria a depender de quanto o dono decidiu se
   *     pagar naquele mês — transferência discricionária, não custo do
   *     serviço. Ressalva medida: hoje esse efeito NÃO existe, porque
   *     `grossProfit` é calculado sem o CSV (ver P44); o argumento vale para
   *     depois que a cascata for corrigida, e foi decidido sabendo disso.
   *
   * O Lucro Líquido não muda com a escolha — o EBITDA soma os três blocos de
   * despesa de qualquer jeito. O que muda é em qual linha do DRE o valor
   * aparece, que é o que este teste trava.
   */
  it('PRD §9.2 P1 — na visão da PJ o pró-labore cai em Despesas Administrativas, não no CSV', () => {
    const pj = statementOf([proLabore(cents(400_000))], 'PJ')

    expect(pj.rows).toHaveLength(1)
    expect(pj.rows[0]?.blockName).toBe('Despesas Administrativas')
    expect(pj.rows[0]?.blockName).not.toBe('Custo dos Serviços/Produtos')
  })
})

describe('computeIncomeStatement — only the requested month is counted', () => {
  it('ignores an entry paid in another month', () => {
    const august = entry({
      kind: 'Expense',
      amount: cents(999_999),
      date: isoDate('2026-08-02'),
      entity: 'PF',
      categoryId: categoryIn('administrativeExpenses'),
      classification: 'Current',
      bankAccountId: PF_ACCOUNT,
    } as Partial<Entry> & Pick<Entry, 'kind' | 'amount'>)
    const statement = statementOf([revenue(cents(1_000_000)), august])
    expect(statement.netProfit).toBe(1_000_000)
  })
})

/**
 * P6 — decisão de produto de 2026-09-08: a parcela de Passivo CONTA no DRE, em
 * Despesas Administrativas, pelo valor cheio.
 *
 * A evidência foi a planilha de referência, lida célula a célula: em JUN, JUL e
 * AGO de 2026, `(-) Financiamento imóvel/veículo` (bloco 4) está PREENCHIDA e
 * `(-) Juros do financiamento` (bloco 8) está ZERADA — a referência não separa
 * juros. E o plano de contas do produto já traz a categoria de destino com o
 * rótulo idêntico ao da planilha (`financiamento-imovel-veiculo`).
 *
 * Antes disso, `sourceOf` sempre devolvia `{ kind: 'Entry' }` e a variante
 * `Installment` do contrato não era produzida por nada: a linha que o Figma
 * 11:2 desenha (nó 235:64, "Financiamento apartamento, parcela 13") não
 * aparecia na tela, e a parcela não entrava na cascata. O DRE subestimava a
 * despesa do mês pela parcela inteira.
 */
describe('computeIncomeStatement — parcela de Passivo (P6)', () => {
  const LIABILITY: Liability = {
    id: asId<LiabilityId>('liab-1'),
    name: 'Financiamento apartamento',
    creditor: 'Caixa Econômica',
    entity: 'PF',
    classification: 'NonCurrent',
    originalAmount: cents(32_000_000),
    installmentAmount: cents(152_000),
    installmentCount: 360,
    installmentsAlreadyPaid: 12,
    monthlyInterestRate: 0.0085,
    startDate: isoDate('2025-08-15'),
  }

  function parcela(partial: Partial<Installment> = {}): Installment {
    return {
      id: asId<InstallmentId>('liab-1#13'),
      liabilityId: LIABILITY.id,
      number: 13,
      plannedDate: isoDate('2026-07-10'),
      plannedAmount: cents(152_000),
      status: 'Planned',
      paidAmount: null,
      paidDate: null,
      discarded: false,
      ...partial,
    }
  }

  function comParcela(
    partial: Partial<Installment> = {},
    statusFilter: 'Paid' | 'Planned' = 'Paid',
  ) {
    return computeIncomeStatement({
      entries: [],
      chart: CHART,
      view: 'Consolidated',
      month: JULY,
      statusFilter,
      liabilities: [LIABILITY],
      installments: [parcela(partial)],
    })
  }

  it('a parcela paga reduz o lucro, dentro de Despesas Administrativas', () => {
    const st = comParcela({
      status: 'Paid',
      paidAmount: cents(152_000),
      paidDate: isoDate('2026-07-10'),
    })

    expect(blockAmount(st, 'administrativeExpenses')).toBe(152_000)
    expect(st.netProfit).toBe(-152_000)
  })

  it('desenha a linha do Figma 11:2 nó 235:64, com origem na parcela e não num Lançamento', () => {
    const st = comParcela({
      status: 'Paid',
      paidAmount: cents(152_000),
      paidDate: isoDate('2026-07-10'),
    })

    expect(st.rows).toHaveLength(1)
    expect(st.rows[0]?.name).toBe('Financiamento apartamento, parcela 13')
    expect(st.rows[0]?.source).toEqual({
      kind: 'Installment',
      installmentId: 'liab-1#13',
      liabilityId: 'liab-1',
    })
  })

  /**
   * PRD §5, regime de caixa — a regra que motivou persistir `paidDate`. Prevista
   * para 10/07 e paga em 02/08: é despesa de AGOSTO, não de julho.
   */
  it('PRD §5 — o mês é o da data de pagamento, não o da prevista', () => {
    const julho = comParcela({
      status: 'Paid',
      paidAmount: cents(152_000),
      paidDate: isoDate('2026-08-02'),
    })

    expect(blockAmount(julho, 'administrativeExpenses')).toBe(0)
    expect(julho.rows).toHaveLength(0)
  })

  it('parcela Prevista fica fora do filtro Pago e entra no Previsto', () => {
    expect(blockAmount(comParcela({}, 'Paid'), 'administrativeExpenses')).toBe(0)
    expect(blockAmount(comParcela({}, 'Planned'), 'administrativeExpenses')).toBe(152_000)
  })

  /**
   * O filtro Pago/Previsto vale para a CASCATA, não para a lista. A legenda do
   * card no Figma 11:2 diz literalmente "Mostra pagos e previstos juntos,
   * independente do filtro da cascata" — e é assim que a linha de Lançamento já
   * se comportava (`buildRows` recebe o mês inteiro). A primeira versão desta
   * implementação aplicou o filtro nos dois, e a parcela Prevista sumia da
   * lista; apareceu ao olhar a tela, não nos testes.
   */
  it('Figma 11:2 — a parcela Prevista aparece na lista mesmo com a cascata em Pago', () => {
    const st = comParcela({}, 'Paid')

    expect(blockAmount(st, 'administrativeExpenses')).toBe(0)
    expect(st.rows).toHaveLength(1)
    expect(st.rows[0]?.status).toBe('Planned')
  })

  it('parcela descartada não entra: "Descartar" pula ESTA ocorrência (Figma 34:2 nó 34:36)', () => {
    const st = comParcela({
      status: 'Paid',
      paidAmount: cents(152_000),
      paidDate: isoDate('2026-07-10'),
      discarded: true,
    })

    expect(blockAmount(st, 'administrativeExpenses')).toBe(0)
    expect(st.rows).toHaveLength(0)
  })

  /**
   * P27 (produto, 2026-09-08), decidida DEPOIS da P6 e por causa dela. A parcela
   * que já nasce Paga no cadastro de uma dívida em andamento — a que o campo
   * "Parcelas já pagas" cria — não tem data de pagamento informada por ninguém
   * (`paidDate` nulo) e tem valor presumido igual ao previsto. Mesmo assim ela
   * CONTA, no mês da data prevista: a pessoa pagou de fato.
   *
   * A consequência foi medida antes de decidir, na fixture sintética: cadastrar
   * o financiamento fez o DRE de 2025-08 — mês em que a pessoa nem usava o
   * produto — mostrar Despesas Administrativas de R$ 2.714,12 e Lucro Líquido
   * de −R$ 2.714,12. É o comportamento pretendido, não um efeito colateral.
   *
   * Este teste existe porque `paidDate === null` é um discriminador exato de
   * "paga na abertura", e é tentador usá-lo para excluí-las da cascata.
   */
  it('P27 — a parcela já paga no cadastro conta, no mês da data prevista, mesmo sem data de pagamento', () => {
    const st = comParcela({ status: 'Paid', paidAmount: cents(152_000), paidDate: null })

    expect(blockAmount(st, 'administrativeExpenses')).toBe(152_000)
    expect(st.rows).toHaveLength(1)
  })

  it('a visão isolada só vê a parcela da sua entidade', () => {
    const pj = computeIncomeStatement({
      entries: [],
      chart: CHART,
      view: 'PJ',
      month: JULY,
      statusFilter: 'Paid',
      liabilities: [LIABILITY],
      installments: [
        parcela({ status: 'Paid', paidAmount: cents(152_000), paidDate: isoDate('2026-07-10') }),
      ],
    })

    expect(blockAmount(pj, 'administrativeExpenses')).toBe(0)
  })
})

describe('"A categorizar" fica fora do DRE — decisão do dono, 2026-09-29', () => {
  it('PRD v7.47 — o que a pessoa não categorizou não entra na cascata nem na lista do mês', () => {
    const CHART_COM_SISTEMA: ChartOfAccounts = {
      ...CHART,
      categories: [...CHART.categories, ...UNCATEGORIZED_CATEGORIES],
    }
    const pendente = entry({
      kind: 'Expense',
      amount: cents(99_000),
      entity: 'PF',
      categoryId: UNCATEGORIZED_EXPENSE_CATEGORY_ID,
      classification: 'Current',
      bankAccountId: PF_ACCOUNT,
    } as Partial<Entry> & Pick<Entry, 'kind' | 'amount'>)
    const categorizada = expense(cents(10_000), 'personalExpenses')

    const statement = computeIncomeStatement({
      entries: [pendente, categorizada],
      chart: CHART_COM_SISTEMA,
      view: 'Consolidated',
      month: JULY,
      statusFilter: 'Paid',
    })
    expect(statement.netProfit).toBe(-10_000)
    expect(statement.rows).toHaveLength(1)
  })
})

describe('Lançamentos deste mês — a linha diz se é de uma série (2026-10-01)', () => {
  it('o lançamento de uma recorrência sai com `recurring`, o avulso sem', () => {
    const avulso = expense(cents(1000))
    const daSerie = { ...expense(cents(2000)), recurrenceId: asId('serie-1') } as Entry
    const { rows } = statementOf([avulso, daSerie])
    expect(
      rows.find((r) => r.amount === cents(1000) || r.amount === cents(-1000))?.recurring,
    ).toBeUndefined()
    expect(rows.find((r) => r.amount === cents(2000) || r.amount === cents(-2000))?.recurring).toBe(
      true,
    )
  })
})

// Pedido do dono, 2026-10-01: "no DRE, quero ter um ícone de olhinho que eu
// possa ocultar um valor para ver como ficaria o DRE sem esse valor, ou uma
// categoria toda". Simulação: nada é gravado; o oculto sai da cascata e
// continua listado, marcado, para voltar.
describe('DRE — ocultar um valor ou uma categoria (simulação, 2026-10-01)', () => {
  function block(statement: IncomeStatement, key: keyof typeof BLOCK_IDS) {
    const line = statement.lines.find((l) => l.kind === 'block' && l.key === BLOCK_IDS[key])
    if (!line || line.kind !== 'block') throw new Error('bloco ausente')
    return line
  }

  it('ocultar um lançamento tira o valor dele da cascata e do Lucro Líquido; a linha continua, marcada', () => {
    const aluguel = expense(cents(100_000))
    const internet = expense(cents(20_000))
    const receita = revenue(cents(500_000))
    const cheio = statementOf([aluguel, internet, receita])
    const simulado = computeIncomeStatement({
      entries: [aluguel, internet, receita],
      chart: CHART,
      view: 'Consolidated',
      month: JULY,
      statusFilter: 'Paid',
      hidden: { rows: new Set([aluguel.id]) },
    })
    expect(simulado.netProfit).toBe(cents(cheio.netProfit + 100_000))
    expect(
      simulado.rows.find((r) => r.source.kind === 'Entry' && r.source.entryId === aluguel.id),
    ).toMatchObject({ hidden: true })
    expect(
      simulado.rows.find((r) => r.source.kind === 'Entry' && r.source.entryId === internet.id)
        ?.hidden,
    ).toBeUndefined()
  })

  it('ocultar uma categoria inteira tira todos os lançamentos dela; o item do bloco fica, marcado oculto', () => {
    const a = expense(cents(100_000))
    const b = expense(cents(30_000))
    const cheio = statementOf([a, b])
    const key = block(cheio, 'administrativeExpenses').breakdown[0]!.key
    const simulado = computeIncomeStatement({
      entries: [a, b],
      chart: CHART,
      view: 'Consolidated',
      month: JULY,
      statusFilter: 'Paid',
      hidden: { groups: new Set([key]) },
    })
    expect(blockAmount(simulado, 'administrativeExpenses')).toBe(ZERO)
    expect(block(simulado, 'administrativeExpenses').breakdown).toEqual([
      expect.objectContaining({ key, hidden: true }),
    ])
    expect(simulado.rows.every((r) => r.hidden === true)).toBe(true)
  })

  it('sem nada oculto, nada muda (e nada vem marcado)', () => {
    const a = expense(cents(100_000))
    const semOcultar = statementOf([a])
    const vazio = computeIncomeStatement({
      entries: [a],
      chart: CHART,
      view: 'Consolidated',
      month: JULY,
      statusFilter: 'Paid',
      hidden: { rows: new Set(), groups: new Set() },
    })
    expect(vazio).toEqual(semOcultar)
  })
})

// "Não precisa reordenar, só recalcular" (dono, 2026-10-01): ocultar muda os
// valores, nunca a posição das linhas do bloco.
describe('DRE — a simulação não reordena o detalhamento do bloco (2026-10-01)', () => {
  const dois = () => {
    const grande = {
      ...expense(cents(100_000)),
      categoryId: categoryIn('administrativeExpenses'),
    } as Entry
    const outraCategoria = CHART.categories.find(
      (c) =>
        c.blockId === BLOCK_IDS.administrativeExpenses &&
        c.id !== categoryIn('administrativeExpenses'),
    )!.id
    const pequeno = { ...expense(cents(30_000)), categoryId: outraCategoria } as Entry
    return { grande, pequeno, entries: [grande, pequeno] }
  }
  const ordem = (statement: IncomeStatement) => {
    const line = statement.lines.find(
      (l) => l.kind === 'block' && l.key === BLOCK_IDS.administrativeExpenses,
    )
    return line?.kind === 'block' ? line.breakdown.map((i) => i.key) : []
  }
  const simular = (entries: Entry[], hidden: { rows?: Set<string>; groups?: Set<string> }) =>
    computeIncomeStatement({
      entries,
      chart: CHART,
      view: 'Consolidated',
      month: JULY,
      statusFilter: 'Paid',
      hidden,
    })

  it('ocultar a categoria maior não a manda para o fim', () => {
    const { entries } = dois()
    const antes = ordem(statementOf(entries))
    const depois = ordem(simular(entries, { groups: new Set([antes[0]!]) }))
    expect(depois).toEqual(antes)
  })

  it('ocultar o único lançamento da categoria maior a mantém no lugar, com o valor recalculado', () => {
    const { grande, entries } = dois()
    const antes = ordem(statementOf(entries))
    const simulado = simular(entries, { rows: new Set([grande.id]) })
    expect(ordem(simulado)).toEqual(antes)
  })
})

// Pedido do dono, 2026-10-01: separar "Lançamentos deste mês" em (+) entradas
// e (−) saídas. A direção vem do efeito no lucro, a mesma regra da cascata.
describe('Lançamentos deste mês — entrada ou saída (2026-10-01)', () => {
  const linhaDe = (statement: IncomeStatement, entry: Entry) =>
    statement.rows.find((r) => r.source.kind === 'Entry' && r.source.entryId === entry.id)

  it('receita é entrada; despesa é saída', () => {
    const r = revenue(cents(500_000))
    const d = expense(cents(100_000))
    const s = statementOf([r, d])
    expect(linhaDe(s, r)?.flow).toBe('In')
    expect(linhaDe(s, d)?.flow).toBe('Out')
  })

  it('PRD §5 — pró-labore é entrada na PF e saída na PJ', () => {
    const p = proLabore(cents(200_000))
    expect(linhaDe(statementOf([p], 'PF'), p)?.flow).toBe('In')
    expect(linhaDe(statementOf([p], 'PJ'), p)?.flow).toBe('Out')
  })

  it('um mês de valor zero ("a definir" em branco) tem a direção que teria com valor', () => {
    const d = expense(ZERO)
    expect(linhaDe(statementOf([d]), d)?.flow).toBe('Out')
  })
})

describe('computeIncomeStatement — ADR-0021, "Cartão de crédito" e "Contabilizar em"', () => {
  it('ADR-0021 — a linha leva a data do lançamento e a marca de cartão', () => {
    const compra = {
      ...expense(cents(5_000)),
      date: isoDate('2026-07-12'),
      isCreditCard: true,
    } as Entry
    const [row] = statementOf([compra]).rows
    expect([row?.date, row?.isCreditCard]).toEqual(['2026-07-12', true])
  })

  it('ADR-0021 — a despesa paga em agosto e "Contabilizar em" julho entra no DRE de julho', () => {
    const compra = {
      ...expense(cents(5_000)),
      date: isoDate('2026-08-15'),
      accountingMonth: month('2026-07'),
    } as Entry
    expect(blockAmount(statementOf([compra]), 'administrativeExpenses')).toBe(5_000)
  })
})

describe('computeIncomeStatement — ADR-0021, filtros "Recorrentes" e "Cartão" recalculam a cascata', () => {
  const recorrente = { ...expense(cents(1_000)), recurrenceId: 'serie-1' } as Entry
  const cartao = { ...expense(cents(2_000)), isCreditCard: true } as Entry
  const avulsa = expense(cents(4_000))

  function filtered(only: { recurring?: boolean; creditCard?: boolean }) {
    return computeIncomeStatement({
      entries: [recorrente, cartao, avulsa],
      chart: CHART,
      view: 'Consolidated',
      month: JULY,
      statusFilter: 'Paid',
      only,
    })
  }

  it('ADR-0021 — "Recorrentes" deixa na cascata e na lista só o que vem de série', () => {
    const st = filtered({ recurring: true })
    expect(blockAmount(st, 'administrativeExpenses')).toBe(1_000)
    expect(st.rows.map((r) => r.amount)).toEqual([1_000])
  })

  it('ADR-0021 — "Cartão" deixa só a despesa do cartão', () => {
    expect(blockAmount(filtered({ creditCard: true }), 'administrativeExpenses')).toBe(2_000)
  })

  it('ADR-0021 — sem filtro, a cascata é o DRE inteiro', () => {
    expect(blockAmount(filtered({}), 'administrativeExpenses')).toBe(7_000)
  })
})

describe('computeIncomeStatement — receita do cartão (dono, 2026-10-09)', () => {
  it('dono 2026-10-09 — o estorno no cartão leva a marca e entra no filtro "Cartão"', () => {
    const estorno = { ...revenue(cents(4), 'PF'), isCreditCard: true } as Entry
    const outra = revenue(cents(1_000), 'PF')
    const st = computeIncomeStatement({
      entries: [estorno, outra],
      chart: CHART,
      view: 'Consolidated',
      month: JULY,
      statusFilter: 'Paid',
      only: { creditCard: true },
    })
    expect(st.rows.map((r) => [r.amount, r.isCreditCard])).toEqual([[4, true]])
  })
})
