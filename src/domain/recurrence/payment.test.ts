import { describe, expect, it } from 'vitest'
import { asId, cents, isoDate, month, ZERO } from '@/domain/core'
import type { BankAccountId, CategoryId, EntryId, IsoDate, RecurrenceId } from '@/domain/core'
import { occurrenceDescription, occurrencePaidWith, payOccurrence } from './payment'
import type { Occurrence, Recurrence } from './types'

/* ---------------------------------------------------------------- fixtures */

const RENT_CATEGORY = asId<CategoryId>('aluguel-moradia')
const PF_ACCOUNT = asId<BankAccountId>('conta-pf')
const RECURRENCE_ID = asId<RecurrenceId>('recorrencia-aluguel')

function fixedRecurrence(over: Partial<Recurrence> = {}): Recurrence {
  return {
    id: RECURRENCE_ID,
    template: {
      kind: 'Expense',
      amount: cents(150_000),
      entity: 'PF',
      categoryId: RENT_CATEGORY,
      classification: 'Current',
      bankAccountId: PF_ACCOUNT,
    },
    amountKind: 'Fixed',
    startDate: isoDate('2026-01-10'),
    endsOn: null,
    closedOn: null,
    ...over,
  }
}

function occurrenceOf(over: Partial<Occurrence> = {}): Occurrence {
  return {
    id: asId('recorrencia-aluguel:2026-07'),
    recurrenceId: RECURRENCE_ID,
    month: month('2026-07'),
    plannedDate: isoDate('2026-07-10'),
    plannedAmount: cents(150_000),
    status: 'Planned',
    discarded: false,
    entryId: null,
    ...over,
  }
}

const PAYMENT_DATE: IsoDate = isoDate('2026-07-12')

/* --------------------------------------------------------- payOccurrence */

describe('Descrição de um mês da série (2026-10-01)', () => {
  const comDescricao = (description: string | null) =>
    fixedRecurrence({
      template: { ...fixedRecurrence().template, description } as Recurrence['template'],
    })

  it('o lançamento pago leva a descrição da série', () => {
    const { newEntry } = payOccurrence({
      recurrence: comDescricao('Aluguel sintético'),
      occurrence: occurrenceOf(),
      paidAmount: cents(150_000),
      paymentDate: PAYMENT_DATE,
    })
    expect(newEntry.description).toBe('Aluguel sintético')
  })

  it('"só esta ocorrência": a descrição do mês vale mais que a da série', () => {
    const recurrence = comDescricao('Aluguel sintético')
    const occurrence = occurrenceOf({ description: 'Aluguel com reajuste' })
    expect(occurrenceDescription(occurrence, recurrence)).toBe('Aluguel com reajuste')
    const { newEntry } = payOccurrence({
      recurrence,
      occurrence,
      paidAmount: cents(150_000),
      paymentDate: PAYMENT_DATE,
    })
    expect(newEntry.description).toBe('Aluguel com reajuste')
  })

  it('sem descrição no mês nem na série, fica sem', () => {
    expect(occurrenceDescription(occurrenceOf(), comDescricao(null))).toBeNull()
  })
})

describe('payOccurrence — building the Lançamento a paid occurrence produces', () => {
  it('carries every kind-specific field of the template into the new entry', () => {
    const { newEntry } = payOccurrence({
      recurrence: fixedRecurrence(),
      occurrence: occurrenceOf(),
      paidAmount: cents(150_000),
      paymentDate: PAYMENT_DATE,
    })

    expect(newEntry).toMatchObject({
      kind: 'Expense',
      entity: 'PF',
      categoryId: RENT_CATEGORY,
      classification: 'Current',
      bankAccountId: PF_ACCOUNT,
      status: 'Paid',
      recurrenceId: RECURRENCE_ID,
    })
    expect(newEntry.amount).toBe(150_000)
    expect(newEntry.date).toBe(PAYMENT_DATE)
  })

  it('PRD §5 — the payment date decides the month, which may differ from the planned one', () => {
    const latePayment = isoDate('2026-08-03')
    const { newEntry } = payOccurrence({
      recurrence: fixedRecurrence(),
      occurrence: occurrenceOf(),
      paidAmount: cents(150_000),
      paymentDate: latePayment,
    })
    expect(newEntry.date).toBe(latePayment)
  })

  describe('the outcome — same asymmetry as markAsPaid (files_design/03 "Marcar Pago")', () => {
    it('is Exact when the paid amount matches the planned one', () => {
      const { outcome } = payOccurrence({
        recurrence: fixedRecurrence(),
        occurrence: occurrenceOf({ plannedAmount: cents(150_000) }),
        paidAmount: cents(150_000),
        paymentDate: PAYMENT_DATE,
      })
      expect(outcome).toEqual({ kind: 'Exact' })
    })

    it('Underpaid: the shortfall becomes its own pending item', () => {
      const { outcome } = payOccurrence({
        recurrence: fixedRecurrence(),
        occurrence: occurrenceOf({ plannedAmount: cents(150_000) }),
        paidAmount: cents(130_000),
        paymentDate: PAYMENT_DATE,
      })
      expect(outcome).toEqual({ kind: 'Underpaid', shortfall: 20_000, becomesPending: true })
    })

    it('Overpaid: the excess is NEVER a pending item', () => {
      const { outcome } = payOccurrence({
        recurrence: fixedRecurrence(),
        occurrence: occurrenceOf({ plannedAmount: cents(150_000) }),
        paidAmount: cents(154_000),
        paymentDate: PAYMENT_DATE,
      })
      expect(outcome).toEqual({ kind: 'Overpaid', excess: 4_000, becomesPending: false })
    })

    it('PRD §5 — "a definir" paid for the first time has no baseline: outcome is null, not Exact', () => {
      const { outcome } = payOccurrence({
        recurrence: fixedRecurrence({ amountKind: 'ToBeDefined' }),
        occurrence: occurrenceOf({ plannedAmount: null }),
        paidAmount: cents(80_000),
        paymentDate: PAYMENT_DATE,
      })
      expect(outcome).toBeNull()
    })
  })

  describe('guards', () => {
    it('recurrence.occurrence_of_another_series — the occurrence must belong to the series it is paid through', () => {
      const otherRecurrence = fixedRecurrence({ id: asId<RecurrenceId>('outra-serie') })
      expect(() =>
        payOccurrence({
          recurrence: otherRecurrence,
          occurrence: occurrenceOf(),
          paidAmount: cents(150_000),
          paymentDate: PAYMENT_DATE,
        }),
      ).toThrow('recurrence.occurrence_of_another_series')
    })

    it('recurrence.occurrence_not_open — a Pago occurrence cannot be paid again', () => {
      expect(() =>
        payOccurrence({
          recurrence: fixedRecurrence(),
          occurrence: occurrenceOf({ status: 'Paid', entryId: asId<EntryId>('entry-1') }),
          paidAmount: cents(150_000),
          paymentDate: PAYMENT_DATE,
        }),
      ).toThrow('recurrence.occurrence_not_open')
    })

    it('recurrence.occurrence_not_open — a Descartada occurrence cannot be paid', () => {
      expect(() =>
        payOccurrence({
          recurrence: fixedRecurrence(),
          occurrence: occurrenceOf({ discarded: true }),
          paidAmount: cents(150_000),
          paymentDate: PAYMENT_DATE,
        }),
      ).toThrow('recurrence.occurrence_not_open')
    })

    it('entries.negative_paid_amount — never a negative valor pago', () => {
      expect(() =>
        payOccurrence({
          recurrence: fixedRecurrence(),
          occurrence: occurrenceOf(),
          paidAmount: cents(-1),
          paymentDate: PAYMENT_DATE,
        }),
      ).toThrow('entries.negative_paid_amount')
    })

    it('paying exactly zero against a planned amount is a full shortfall, not a crash', () => {
      const { outcome } = payOccurrence({
        recurrence: fixedRecurrence(),
        occurrence: occurrenceOf({ plannedAmount: cents(150_000) }),
        paidAmount: ZERO,
        paymentDate: PAYMENT_DATE,
      })
      expect(outcome).toEqual({ kind: 'Underpaid', shortfall: 150_000, becomesPending: true })
    })
  })
})

/* ---------------------------------------------------------- occurrencePaidWith */

describe('occurrencePaidWith — the occurrence half of marking one paid', () => {
  it('moves the occurrence to Pago, stamps the amount actually paid and the new entry id', () => {
    const paid = occurrencePaidWith(occurrenceOf(), asId<EntryId>('entry-99'), cents(130_000))
    expect(paid.status).toBe('Paid')
    expect(paid.plannedAmount).toBe(130_000)
    expect(paid.entryId).toBe('entry-99')
    // Everything else about the occurrence — which series, which month — is untouched.
    expect(paid.recurrenceId).toBe(RECURRENCE_ID)
    expect(paid.month).toBe('2026-07')
  })
})
