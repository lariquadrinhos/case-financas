import { describe, expect, it } from 'vitest'
import { asId, cents, isoDate, month } from '@/domain/core'
import type {
  BankAccountId,
  CategoryId,
  Cents,
  EntryId,
  InstallmentId,
  LiabilityId,
} from '@/domain/core'
import { BLOCK_IDS, type ChartOfAccounts } from '@/domain/chart-of-accounts/types'
import { initializeChartOfAccounts } from '@/domain/chart-of-accounts/rules'
import type { Entry } from '@/domain/entries'
import type { Installment, Liability } from '@/domain/assets'
import { computeIncomeStatement } from './income-statement'
import type { IncomeStatement, StatementBlockLine } from './types'

/**
 * DRE expansível (pedido de produto, 2026-09-23): cada linha de bloco da
 * cascata abre o total por categoria do Plano de Contas. A quebra nasce no
 * MESMO laço que soma a linha — mesmo filtro Pago/Previsto, mesma eliminação
 * intercompany, mesma visão —, então a soma dela é a linha, por construção.
 * Dados sintéticos.
 */

const JULY = month('2026-07')
const CHART: ChartOfAccounts = initializeChartOfAccounts()
const PF = asId<BankAccountId>('pf')
const PJ = asId<BankAccountId>('pj')

function categoriesIn(blockKey: keyof typeof BLOCK_IDS): CategoryId[] {
  return CHART.categories.filter((c) => c.blockId === BLOCK_IDS[blockKey]).map((c) => c.id)
}
function nameOf(id: CategoryId): string {
  return CHART.categories.find((c) => c.id === id)!.name
}

let seq = 0
function expense(
  amount: number,
  categoryId: CategoryId,
  status: 'Paid' | 'Planned' = 'Paid',
): Entry {
  return {
    id: asId<EntryId>(`e-${(seq += 1)}`),
    kind: 'Expense',
    amount: cents(amount),
    date: isoDate('2026-07-10'),
    status,
    recurrenceId: null,
    entity: 'PF',
    categoryId,
    classification: 'Current',
    bankAccountId: PF,
  } as Entry
}
function proLabore(amount: number): Entry {
  return {
    id: asId<EntryId>(`e-${(seq += 1)}`),
    kind: 'ProLabore',
    amount: cents(amount),
    date: isoDate('2026-07-10'),
    status: 'Paid',
    recurrenceId: null,
    sourceAccountId: PJ,
    destinationAccountId: PF,
  } as Entry
}

function block(statement: IncomeStatement, key: keyof typeof BLOCK_IDS): StatementBlockLine {
  const line = statement.lines.find((l) => l.kind === 'block' && l.key === BLOCK_IDS[key])
  if (!line || line.kind !== 'block') throw new Error(`block ${key} missing`)
  return line
}
const sum = (items: readonly { amount: Cents }[]) => items.reduce((t, i) => t + i.amount, 0)

describe('DRE — total por categoria em cada linha de bloco', () => {
  const [a, b] = categoriesIn('costOfServices') as [CategoryId, CategoryId]

  it('agrupa por categoria, maior primeiro, e a soma é a própria linha', () => {
    const statement = computeIncomeStatement({
      entries: [expense(25_500, a), expense(25_331, b), expense(1_000, a)],
      chart: CHART,
      view: 'Consolidated',
      month: JULY,
      statusFilter: 'Paid',
    })
    const line = block(statement, 'costOfServices')

    expect(line.breakdown).toEqual([
      { key: `category:${a}`, label: nameOf(a), amount: 26_500 },
      { key: `category:${b}`, label: nameOf(b), amount: 25_331 },
    ])
    expect(sum(line.breakdown)).toBe(line.amount)
  })

  it('PRD §5 — respeita o filtro da cascata: Previsto não entra na quebra de "Pago"', () => {
    const statement = computeIncomeStatement({
      entries: [expense(25_500, a), expense(9_999, b, 'Planned')],
      chart: CHART,
      view: 'Consolidated',
      month: JULY,
      statusFilter: 'Paid',
    })
    const line = block(statement, 'costOfServices')

    expect(line.breakdown.map((item) => item.key)).toEqual([`category:${a}`])
    expect(sum(line.breakdown)).toBe(line.amount)
  })

  it('PRD §5 — eliminação intercompany: no Consolidado o pró-labore não aparece em bloco nenhum', () => {
    const statement = computeIncomeStatement({
      entries: [proLabore(800_000)],
      chart: CHART,
      view: 'Consolidated',
      month: JULY,
      statusFilter: 'Paid',
    })
    for (const line of statement.lines)
      if (line.kind === 'block') expect(line.breakdown).toEqual([])
  })

  it('na visão PF, o pró-labore é uma linha própria da quebra, não uma categoria', () => {
    const statement = computeIncomeStatement({
      entries: [proLabore(800_000)],
      chart: CHART,
      view: 'PF',
      month: JULY,
      statusFilter: 'Paid',
    })
    const withProLabore = statement.lines.find(
      (l) => l.kind === 'block' && l.breakdown.length > 0,
    ) as StatementBlockLine
    expect(withProLabore.breakdown).toEqual([
      { key: 'kind:ProLabore', label: 'Pró-labore', amount: withProLabore.amount },
    ])
  })

  it('P6 — a parcela de passivo entra na quebra de Despesas Administrativas pelo nome do passivo', () => {
    const liability = {
      id: asId<LiabilityId>('lia'),
      name: 'Financiamento sintético',
      entity: 'PF',
    } as Liability
    const installment = {
      id: asId<InstallmentId>('inst'),
      liabilityId: liability.id,
      number: 3,
      plannedDate: isoDate('2026-07-05'),
      plannedAmount: cents(120_000),
      status: 'Paid',
      paidDate: isoDate('2026-07-05'),
      paidAmount: cents(120_000),
      discarded: false,
    } as Installment
    const statement = computeIncomeStatement({
      entries: [],
      chart: CHART,
      view: 'Consolidated',
      month: JULY,
      statusFilter: 'Paid',
      liabilities: [liability],
      installments: [installment],
    })
    const line = block(statement, 'administrativeExpenses')

    expect(line.breakdown).toEqual([
      { key: 'liability:lia', label: 'Financiamento sintético', amount: 120_000 },
    ])
  })

  it('linha sem movimento não tem quebra (a seta não aparece)', () => {
    const statement = computeIncomeStatement({
      entries: [],
      chart: CHART,
      view: 'Consolidated',
      month: JULY,
      statusFilter: 'Paid',
    })
    for (const line of statement.lines)
      if (line.kind === 'block') expect(line.breakdown).toEqual([])
  })
})

/**
 * "Ver previsão do mês" (pedido de produto, 2026-09-23): um pró-labore Pago de
 * 09/10 sumia do DRE de outubro, porque o mês futuro abre em Previsto e os dois
 * filtros são exclusivos (files_design/01 §8.1). A previsão do mês é um modo à
 * parte — pago E previsto, como o mês vai fechar —; Pago e Previsto seguem
 * exclusivos.
 */
describe('DRE — previsão do mês', () => {
  const [a] = categoriesIn('costOfServices') as [CategoryId]
  const input = {
    entries: [expense(10_000, a, 'Paid'), expense(5_000, a, 'Planned')],
    chart: CHART,
    view: 'Consolidated' as const,
    month: JULY,
  }

  it('soma o pago e o previsto do mês', () => {
    const statement = computeIncomeStatement({ ...input, statusFilter: 'Planned', forecast: true })
    expect(block(statement, 'costOfServices').amount).toBe(15_000)
    expect(statement.forecast).toBe(true)
  })

  it('PRD §1 e dono 2026-10-09 — Pago é só o realizado; Previsto é o pago mais o previsto', () => {
    expect(
      block(computeIncomeStatement({ ...input, statusFilter: 'Paid' }), 'costOfServices').amount,
    ).toBe(10_000)
    expect(
      block(computeIncomeStatement({ ...input, statusFilter: 'Planned' }), 'costOfServices').amount,
    ).toBe(15_000)
  })
})
