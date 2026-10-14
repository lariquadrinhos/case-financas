import { describe, expect, it } from 'vitest'
import { cents, month } from '@/domain/core'
import { defaultStatusFilterFor } from '@/domain/reports'
import { groupByName, splitFlowRows, type BlockEffect, type StatementRow } from './cash-flow'

const EFFECTS = new Map<string, BlockEffect>([
  ['receita-bruta', 'Add'],
  ['despesas-administrativas', 'Subtract'],
  ['resultado-financeiro', 'Signed'],
])

const row = (over: Partial<StatementRow> = {}): StatementRow => ({
  name: 'Aluguel moradia',
  blockId: 'despesas-administrativas',
  status: 'Paid',
  amount: 150_000,
  ...over,
})

/**
 * files_design/08 §5.2: "entradas ≠ saídas **não deve acontecer**: o total é
 * fechado por construção". O card monta as colunas a partir de
 * `incomeStatement.rows`, que por contrato (src/api/contracts/reports.ts) traz
 * Pago E Previsto juntos, e a linha "Sobrou" a partir de `netProfit`, que
 * respeita `statusFilter`. Sem o recorte por status as duas metades discordam.
 *
 * Esta é uma das duas inversões verificadas: removi o `if (row.status !==
 * statusFilter) continue`, o primeiro teste ficou vermelho ("expected [] to
 * have a length of 0 but got 1"), e restaurei.
 */
describe('splitFlowRows — files_design/08 §5.2', () => {
  it('ignora o lançamento cujo status não é o do filtro (senão a coluna discorda de "Sobrou")', () => {
    const rows = [row({ status: 'Planned' })]

    const { outflows } = splitFlowRows(rows, EFFECTS, 'Paid')

    expect(outflows).toHaveLength(0)
  })

  it('mantém o lançamento cujo status é o do filtro', () => {
    const rows = [row({ status: 'Planned' })]

    const { outflows } = splitFlowRows(rows, EFFECTS, 'Planned')

    expect(outflows).toEqual([{ name: 'Aluguel moradia', amount: 150_000 }])
  })

  it('separa entrada de saída pelo EFEITO do bloco na cascata, nunca pelo nome', () => {
    const rows = [
      row({ name: 'Salário', blockId: 'receita-bruta', amount: 1_800_000 }),
      row({ name: 'Aluguel moradia' }),
    ]

    const { inflows, outflows } = splitFlowRows(rows, EFFECTS, 'Paid')

    expect(inflows.map((r) => r.name)).toEqual(['Salário'])
    expect(outflows.map((r) => r.name)).toEqual(['Aluguel moradia'])
  })

  it('bloco Signed negativo vira saída, com o valor já positivo pra coluna', () => {
    const rows = [row({ name: 'Juros', blockId: 'resultado-financeiro', amount: -40_000 })]

    const { inflows, outflows } = splitFlowRows(rows, EFFECTS, 'Paid')

    expect(inflows).toHaveLength(0)
    expect(outflows).toEqual([{ name: 'Juros', amount: 40_000 }])
  })

  it('bloco de efeito desconhecido não entra em nenhuma das duas colunas', () => {
    const rows = [row({ blockId: 'bloco-que-nao-existe' })]

    const { inflows, outflows } = splitFlowRows(rows, EFFECTS, 'Paid')

    expect(inflows).toHaveLength(0)
    expect(outflows).toHaveLength(0)
  })
})

describe('groupByName', () => {
  it('soma lançamentos do mesmo bloco numa linha só', () => {
    const grouped = groupByName([
      { name: 'Consumo Livre', amount: cents(12_000) },
      { name: 'Consumo Livre', amount: cents(8_000) },
      { name: 'Água', amount: cents(30_000) },
    ])

    expect(grouped).toEqual([
      { id: 'Consumo Livre', name: 'Consumo Livre', value: 20_000 },
      { id: 'Água', name: 'Água', value: 30_000 },
    ])
  })
})

/**
 * files_design/03, DRE: "Default: Pago em mês atual/passado; Previsto em mês
 * futuro" — regra que a PRD v7, reversão (A), estende a Entradas e Saídas, e
 * que a própria legenda do card promete ("mês futuro mostra projeção"). O card
 * pedia `Paid` fixo, então todo mês futuro vinha zerado.
 */
describe('o card pede o statusFilter que a legenda promete', () => {
  it('mês futuro pede Previsto, não Pago', () => {
    expect(defaultStatusFilterFor(month('2026-12'), month('2026-09'))).toBe('Planned')
  })

  it('mês atual e mês passado pedem Pago', () => {
    expect(defaultStatusFilterFor(month('2026-09'), month('2026-09'))).toBe('Paid')
    expect(defaultStatusFilterFor(month('2026-07'), month('2026-09'))).toBe('Paid')
  })
})
