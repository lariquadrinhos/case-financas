/**
 * "Tipo de valor" na ação rápida de Editar da Revisão de Recorrentes.
 *
 * The rule under test is drawn, not assumed: Wireframe frame `71:11`
 * ("Estado — Tooltips de ajuda"), card `74:14` "④ Hover: Tipo de valor
 * (recorrência)", texts `75:2`-`75:6`
 * (docs/figma/frames/71-11__estado-tooltips-de-ajuda-status-classificacao-tipo-de-valor-sub-tipo.xml).
 */

import { describe, expect, it } from 'vitest'
import { asId, cents, isoDate, month } from '@/domain/core'
import type { BankAccountId, CategoryId, EntryId, OccurrenceId, RecurrenceId } from '@/domain/core'
import {
  editOccurrence,
  occurrenceOfMonth,
  deductFromNextOccurrence,
  templateFromEntry,
} from './engine'
import type { Occurrence, Recurrence } from './types'

/* ---------------------------------------------------------------- fixtures */

const ENERGY_CATEGORY = asId<CategoryId>('energia-moradia')
const PF_ACCOUNT = asId<BankAccountId>('conta-pf')
const RECURRENCE_ID = asId<RecurrenceId>('recorrencia-energia')

const TEMPLATE_AMOUNT = cents(150_000)

function recurrenceOf(over: Partial<Recurrence> = {}): Recurrence {
  return {
    id: RECURRENCE_ID,
    template: {
      kind: 'Expense',
      amount: TEMPLATE_AMOUNT,
      entity: 'PF',
      categoryId: ENERGY_CATEGORY,
      classification: 'Current',
      bankAccountId: PF_ACCOUNT,
    },
    amountKind: 'ToBeDefined',
    startDate: isoDate('2026-01-10'),
    endsOn: null,
    closedOn: null,
    ...over,
  }
}

function occurrenceOf(over: Partial<Occurrence> = {}): Occurrence {
  return {
    id: asId('recorrencia-energia:2026-07'),
    recurrenceId: RECURRENCE_ID,
    month: month('2026-07'),
    plannedDate: isoDate('2026-07-10'),
    plannedAmount: null,
    status: 'Planned',
    discarded: false,
    entryId: null,
    ...over,
  }
}

const NEW_AMOUNT = cents(18_990)

/* -------------------------------------------------- editOccurrence · escopo */

describe('editOccurrence — Figma 34:2 §34:21 "② Editar"', () => {
  it('Figma 71:11 §75:3 — "Toda a série" numa recorrência "a definir" não converte para "fixo": o mês seguinte nasce em branco', () => {
    const recurrence = recurrenceOf()
    const occurrence = occurrenceOf()

    const result = editOccurrence({
      recurrence,
      occurrences: [occurrence],
      occurrenceId: occurrence.id,
      change: { plannedAmount: NEW_AMOUNT },
      scope: 'WholeSeries',
    })

    expect(result.recurrence.amountKind).toBe('ToBeDefined')
    expect(occurrenceOfMonth(result.recurrence, month('2026-08'))?.plannedAmount).toBeNull()
  })

  it('Figma 71:11 §75:3 — uma série "a definir" não guarda valor de série: "Toda a série" preenche as ocorrências em aberto, não o template', () => {
    const recurrence = recurrenceOf()
    const occurrence = occurrenceOf()

    const result = editOccurrence({
      recurrence,
      occurrences: [occurrence],
      occurrenceId: occurrence.id,
      change: { plannedAmount: NEW_AMOUNT },
      scope: 'WholeSeries',
    })

    expect(result.recurrence.template.amount).toBe(TEMPLATE_AMOUNT)
    expect(result.occurrences[0]?.plannedAmount).toBe(NEW_AMOUNT)
  })

  it('Figma 71:11 §75:2 — numa série "fixo" o valor se repete todo mês, então "Toda a série" reescreve o template', () => {
    const recurrence = recurrenceOf({ amountKind: 'Fixed' })
    const occurrence = occurrenceOf({ plannedAmount: TEMPLATE_AMOUNT })

    const result = editOccurrence({
      recurrence,
      occurrences: [occurrence],
      occurrenceId: occurrence.id,
      change: { plannedAmount: NEW_AMOUNT },
      scope: 'WholeSeries',
    })

    expect(result.recurrence.template.amount).toBe(NEW_AMOUNT)
    expect(occurrenceOfMonth(result.recurrence, month('2026-08'))?.plannedAmount).toBe(NEW_AMOUNT)
  })

  it('Figma 34:2 §34:27 — "Só esta ocorrência" não toca o template nem as demais', () => {
    const recurrence = recurrenceOf({ amountKind: 'Fixed' })
    const july = occurrenceOf({ plannedAmount: TEMPLATE_AMOUNT })
    const august = occurrenceOf({
      id: asId<OccurrenceId>('recorrencia-energia:2026-08'),
      month: month('2026-08'),
      plannedDate: isoDate('2026-08-10'),
      plannedAmount: TEMPLATE_AMOUNT,
    })

    const result = editOccurrence({
      recurrence,
      occurrences: [july, august],
      occurrenceId: july.id,
      change: { plannedAmount: NEW_AMOUNT },
      scope: 'ThisOnly',
    })

    expect(result.recurrence.template.amount).toBe(TEMPLATE_AMOUNT)
    expect(result.occurrences[0]?.plannedAmount).toBe(NEW_AMOUNT)
    expect(result.occurrences[1]?.plannedAmount).toBe(TEMPLATE_AMOUNT)
  })
})

/**
 * ADR-0017 §5 — "Descontar da próxima ocorrência".
 *
 * As três recusas não são defensividade: cada uma corresponde a um estado que o
 * MODELO admite e que a fonte de design não cobre. `Recurrence.endsOn` permite
 * a série acabar; uma série `ToBeDefined` tem `plannedAmount: null`; e nada no
 * "Marcar Pago" limita o quanto se pode pagar a mais.
 *
 * Descontar "o que couber" foi medido e recusado como alternativa: zeraria o
 * mês seguinte e faria sumir o resto sem virar nada, num fluxo cuja regra
 * escrita é que pagar a mais NUNCA vira pendência (files_design/03).
 */
describe('deductFromNextOccurrence — ADR-0017 §5', () => {
  const proxima = (parcial: Partial<Occurrence> = {}): Occurrence => ({
    id: asId<OccurrenceId>('serie-sintetica:2026-10'),
    recurrenceId: asId<RecurrenceId>('serie-sintetica'),
    month: month('2026-10'),
    plannedDate: isoDate('2026-10-10'),
    plannedAmount: cents(150000),
    status: 'Planned',
    discarded: false,
    entryId: null,
    ...parcial,
  })

  it('reduz o previsto do mês seguinte pelo excesso', () => {
    const resultado = deductFromNextOccurrence(proxima(), cents(20000))
    expect(resultado.plannedAmount).toBe(cents(130000))
  })

  it('recusa quando a série não tem próximo mês', () => {
    expect(() => deductFromNextOccurrence(null, cents(20000))).toThrow(
      'recurrence.no_next_occurrence',
    )
  })

  it('recusa quando o mês seguinte ainda é "a definir"', () => {
    expect(() => deductFromNextOccurrence(proxima({ plannedAmount: null }), cents(20000))).toThrow(
      'recurrence.next_amount_to_be_defined',
    )
  })

  it('recusa quando o desconto não cabe, em vez de zerar e perder o resto', () => {
    expect(() => deductFromNextOccurrence(proxima(), cents(350000))).toThrow(
      'recurrence.deduction_does_not_fit',
    )
  })

  it('recusa mexer num mês seguinte que já foi pago ou descartado', () => {
    expect(() => deductFromNextOccurrence(proxima({ status: 'Paid' }), cents(20000))).toThrow(
      'recurrence.occurrence_not_open',
    )
  })
})

/* ------------------------------- editOccurrence · todos os dados (2026-10-01) */

// Pedido do dono: "as recorrências não estão aceitando descrição, nem mesmo no
// modo de edição, além de que não consigo atualizar todos os dados da
// recorrência, como categoria". O alcance continua sendo escolhido como hoje
// ("ele pode escolher como edita como tá hoje").
describe('editOccurrence — descrição e dados da série (2026-10-01)', () => {
  const OTHER_CATEGORY = asId<CategoryId>('agua-moradia')

  it('"Só esta ocorrência" muda a descrição só deste mês; a série fica como estava', () => {
    const recurrence = recurrenceOf({
      template: { ...recurrenceOf().template, description: 'Energia sintética' },
    })
    const occurrence = occurrenceOf()
    const result = editOccurrence({
      recurrence,
      occurrences: [occurrence],
      occurrenceId: occurrence.id,
      change: { plannedAmount: NEW_AMOUNT, description: 'Energia com bandeira vermelha' },
      scope: 'ThisOnly',
    })
    expect(result.occurrences[0]?.description).toBe('Energia com bandeira vermelha')
    expect(result.recurrence.template.description).toBe('Energia sintética')
  })

  it('"Só esta ocorrência" não muda categoria nem conta: não há onde guardar isso num mês só', () => {
    const occurrence = occurrenceOf()
    expect(() =>
      editOccurrence({
        recurrence: recurrenceOf(),
        occurrences: [occurrence],
        occurrenceId: occurrence.id,
        change: {
          plannedAmount: NEW_AMOUNT,
          template: {
            ...recurrenceOf().template,
            categoryId: OTHER_CATEGORY,
          } as Recurrence['template'],
        },
        scope: 'ThisOnly',
      }),
    ).toThrow('recurrence.this_only_changes_amount_and_description')
  })

  it('"Toda a série" troca categoria e descrição da série; o mês em aberto perde a descrição própria e o pago não muda', () => {
    const recurrence = recurrenceOf({ amountKind: 'Fixed' })
    const aberta = occurrenceOf({ plannedAmount: TEMPLATE_AMOUNT, description: 'Só julho' })
    const paga = occurrenceOf({
      id: asId<OccurrenceId>('recorrencia-energia:2026-06'),
      month: month('2026-06'),
      plannedDate: isoDate('2026-06-10'),
      plannedAmount: TEMPLATE_AMOUNT,
      status: 'Paid',
      entryId: asId<EntryId>('lancamento-junho'),
      description: 'Junho pago',
    })
    const result = editOccurrence({
      recurrence,
      occurrences: [paga, aberta],
      occurrenceId: aberta.id,
      change: {
        plannedAmount: NEW_AMOUNT,
        description: 'Água sintética',
        template: { ...recurrence.template, categoryId: OTHER_CATEGORY } as Recurrence['template'],
      },
      scope: 'WholeSeries',
    })
    const template = result.recurrence.template
    expect(template.kind === 'Expense' && template.categoryId).toBe(OTHER_CATEGORY)
    expect(template.description).toBe('Água sintética')
    expect(template.amount).toBe(NEW_AMOUNT)
    expect(result.occurrences.find((o) => o.id === aberta.id)?.description ?? null).toBeNull()
    expect(result.occurrences.find((o) => o.id === paga.id)).toEqual(paga)
  })

  it('a natureza do lançamento não muda pela edição da série (despesa continua despesa)', () => {
    const occurrence = occurrenceOf()
    expect(() =>
      editOccurrence({
        recurrence: recurrenceOf(),
        occurrences: [occurrence],
        occurrenceId: occurrence.id,
        change: {
          plannedAmount: NEW_AMOUNT,
          template: {
            kind: 'Revenue',
            amount: NEW_AMOUNT,
            entity: 'PF',
            categoryId: OTHER_CATEGORY,
            classification: 'Current',
            bankAccountId: PF_ACCOUNT,
          },
        },
        scope: 'WholeSeries',
      }),
    ).toThrow('recurrence.kind_change')
  })
})

describe('templateFromEntry — ADR-0021', () => {
  const entry = {
    kind: 'Expense' as const,
    amount: cents(5_490),
    date: isoDate('2026-10-15'),
    status: 'Paid' as const,
    recurrenceId: null,
    entity: 'PF' as const,
    categoryId: asId<CategoryId>('assinaturas'),
    classification: 'Current' as const,
    bankAccountId: asId<BankAccountId>('conta-pf'),
    isCreditCard: true,
    accountingMonth: month('2026-09'),
  }

  it('ADR-0021 — a série leva o "Cartão de crédito" para todo mês', () => {
    expect(templateFromEntry(entry)).toMatchObject({ isCreditCard: true })
  })

  it('ADR-0021 — a série NÃO leva o "Contabilizar em": cada ocorrência fica no próprio mês', () => {
    expect(templateFromEntry(entry)).not.toHaveProperty('accountingMonth')
  })
})
