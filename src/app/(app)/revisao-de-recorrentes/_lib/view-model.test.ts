import { describe, expect, it } from 'vitest'
import { cents } from '@/domain/core'
import { classifyPayment, buildReviewRows } from './view-model'
import type {
  Category,
  Installment,
  Liability,
  Occurrence,
  Recurrence,
  StatementBlock,
} from './queries'

/**
 * files_design/03 "Marcar Pago": the sign of (valor pago − valor previsto)
 * decides which of three completely different UI branches the dialog shows —
 * confirm and close (Exact), a pending-shortfall warning (Underpaid, files_design/03:
 * "a diferença fica como pendente"), or the three-way overpayment choice
 * (Overpaid, files_design/03: "a diferença nunca vira Pendência"). Getting the
 * sign backwards would offer the wrong dialog for the wrong direction of error —
 * exactly the kind of defect PRD §5's "pago a menos vira Pendência, pago a mais
 * nunca vira" exists to prevent.
 */
describe('classifyPayment — PRD §5 / files_design/03 "Marcar Pago"', () => {
  it('is NoBaseline when there is no planned amount to compare against ("a definir" paid for the first time)', () => {
    expect(classifyPayment(null, cents(15000))).toBe('NoBaseline')
  })

  it('is Exact when paid equals planned', () => {
    expect(classifyPayment(cents(15000), cents(15000))).toBe('Exact')
  })

  it('is Underpaid when paid is BELOW planned (files_design/03: "a diferença fica como pendente")', () => {
    expect(classifyPayment(cents(15000), cents(13000))).toBe('Underpaid')
  })

  it('is Overpaid when paid is ABOVE planned (files_design/03: "a diferença nunca vira Pendência")', () => {
    expect(classifyPayment(cents(15000), cents(17000))).toBe('Overpaid')
  })
})

const BLOCKS: StatementBlock[] = [
  {
    id: 'block-4',
    name: 'Despesas Administrativas',
    order: 4,
    effect: 'Subtract',
    belowTheLine: false,
    acceptsUserCategories: true,
    statementLabel: null,
  },
]

const CATEGORIES: Category[] = [
  {
    id: 'cat-aluguel',
    blockId: 'block-4',
    name: 'Aluguel',
    isSystem: false,
    suggestedClassification: null,
    archived: false,
    isPassiveIncome: false,
  },
]

function recurrence(overrides: Partial<Recurrence>): Recurrence {
  return {
    id: 'rec-1',
    amountKind: 'Fixed',
    startDate: '2026-01-10',
    outstandingBalance: 0,
    endsOn: null,
    closedOn: null,
    template: {
      kind: 'Expense',
      entity: 'PJ',
      categoryId: 'cat-aluguel',
      classification: 'Current',
      bankAccountId: 'acc-1',
      amount: 150000,
    },
    ...overrides,
  } as Recurrence
}

function occurrence(overrides: Partial<Occurrence>): Occurrence {
  return {
    id: 'occ-1',
    recurrenceId: 'rec-1',
    month: '2026-07',
    plannedDate: '2026-07-10',
    plannedAmount: 150000,
    status: 'Planned',
    discarded: false,
    entryId: null,
    ...overrides,
  }
}

describe('buildReviewRows — files_design/01 §6 (Revisão de Recorrentes)', () => {
  it('titles an Expense occurrence by its category name and describes entity/block/valor kind', () => {
    const rows = buildReviewRows({
      occurrences: [occurrence({})],
      recurrences: [recurrence({})],
      categories: CATEGORIES,
      statementBlocks: BLOCKS,
      liabilities: [],
      installmentsByLiability: {},
      month: '2026-07',
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      kind: 'Occurrence',
      title: 'Aluguel',
      subtitle: 'PJ · Despesas Administrativas · valor fixo',
    })
  })

  it('titles a ProLabore occurrence by the entry kind, never "Intercompany" (glossário fechado)', () => {
    const rows = buildReviewRows({
      occurrences: [occurrence({ id: 'occ-2', recurrenceId: 'rec-2' })],
      recurrences: [
        recurrence({
          id: 'rec-2',
          template: {
            kind: 'ProLabore',
            sourceAccountId: 'pj-1',
            destinationAccountId: 'pf-1',
            amount: 400000,
          } as Recurrence['template'],
        }),
      ],
      categories: CATEGORIES,
      statementBlocks: BLOCKS,
      liabilities: [],
      installmentsByLiability: {},
      month: '2026-07',
    })

    expect(rows[0]?.title).toBe('Pró-labore')
    expect(rows[0]?.subtitle).not.toContain('Intercompany')
  })

  it('appends an installment row for a liability whose instalment falls in the selected month', () => {
    const liability: Liability = {
      id: 'liab-1',
      name: 'Financiamento apartamento',
      creditor: 'Caixa Econômica',
      entity: 'PF',
      classification: 'NonCurrent',
      originalAmount: 32000000,
      installmentAmount: 152000,
      installmentCount: 360,
      installmentsAlreadyPaid: 12,
      monthlyInterestRate: 0.0085,
      startDate: '2025-08-10',
      outstandingBalance: 0,
    }
    const installment: Installment = {
      id: 'liab-1#13',
      liabilityId: 'liab-1',
      number: 13,
      plannedDate: '2026-07-10',
      plannedAmount: 152000,
      status: 'Planned',
      discarded: false,
      paidAmount: null,
      paidDate: null,
    }

    const rows = buildReviewRows({
      occurrences: [],
      recurrences: [],
      categories: [],
      statementBlocks: [],
      liabilities: [liability],
      installmentsByLiability: { 'liab-1': [installment] },
      month: '2026-07',
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: 'Installment' })
    expect(rows[0]?.title).toContain('Financiamento apartamento')
    expect(rows[0]?.title).toContain('13/360')
  })

  /**
   * Figma `10:2` (Wireframe) desenha a parcela de Passivo em `144:6`, um
   * container IRMÃO e POSTERIOR à lista de ocorrências `10:27` — a lista
   * termina em y=563 e a parcela começa em y=583 (20px), contra os 10px que
   * separam as 5 linhas dentro de `10:27`. Figma `822:410` (Mockup) concorda:
   * `822:604` é a sexta e última "Linha da tabela" do card `822:528`. Nenhum
   * dos dois frames desenha data em linha alguma, então data não pode ordenar
   * os grupos entre si.
   */
  it('Figma 10:2 (144:6 após 10:27) / 822:410 (822:604 por último) — a parcela de Passivo vem depois das ocorrências, mesmo vencendo antes', () => {
    const liability: Liability = {
      id: 'liab-1',
      name: 'Financiamento apartamento',
      creditor: 'Caixa Econômica',
      entity: 'PF',
      classification: 'NonCurrent',
      originalAmount: 32000000,
      installmentAmount: 152000,
      installmentCount: 360,
      installmentsAlreadyPaid: 12,
      monthlyInterestRate: 0.0085,
      startDate: '2025-08-10',
      outstandingBalance: 0,
    }
    const installment: Installment = {
      id: 'liab-1#13',
      liabilityId: 'liab-1',
      number: 13,
      plannedDate: '2026-07-10',
      plannedAmount: 152000,
      status: 'Planned',
      discarded: false,
      paidAmount: null,
      paidDate: null,
    }

    const rows = buildReviewRows({
      // Vence DEPOIS da parcela: se a data ordenasse a lista inteira, esta
      // ocorrência cairia abaixo da parcela e inverteria os dois frames.
      occurrences: [occurrence({ plannedDate: '2026-07-20' })],
      recurrences: [recurrence({})],
      categories: CATEGORIES,
      statementBlocks: BLOCKS,
      liabilities: [liability],
      installmentsByLiability: { 'liab-1': [installment] },
      month: '2026-07',
    })

    expect(rows.map((row) => row.kind)).toEqual(['Occurrence', 'Installment'])
  })
})
