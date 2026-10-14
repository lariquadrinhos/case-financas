import { describe, expect, it } from 'vitest'
import {
  asId,
  cents,
  isoDate,
  type BankAccountId,
  type CategoryId,
  type EntryId,
  type RecurrenceId,
} from '@/domain/core'
import type { Entry } from '@/domain/entries'
import { planSeriesConversion } from './conversion'
import type { Recurrence } from './types'

// Dados sintéticos: a forma de uma série criada antes da ADR-0019.
const REC = asId<RecurrenceId>('rec-1')
const series: Recurrence = {
  id: REC,
  template: {
    kind: 'Expense',
    amount: cents(25_500),
    entity: 'PF',
    categoryId: asId<CategoryId>('cat'),
    classification: 'Current',
    bankAccountId: asId<BankAccountId>('acc'),
  } as Recurrence['template'],
  amountKind: 'Fixed',
  startDate: isoDate('2026-11-15'),
  endsOn: null,
  closedOn: null,
}

function origin(status: 'Planned' | 'Paid', date = '2026-10-15', id = 'origin'): Entry {
  return {
    id: asId<EntryId>(id),
    kind: 'Expense',
    amount: cents(25_500),
    date: isoDate(date),
    status,
    recurrenceId: REC,
    entity: 'PF',
    categoryId: asId<CategoryId>('cat'),
    classification: 'Current',
    bankAccountId: asId<BankAccountId>('acc'),
  } as Entry
}

describe('planSeriesConversion — ADR-0019, séries anteriores à decisão', () => {
  it('Previsto: a série passa a começar no mês da origem, que vira a ocorrência Prevista e sai como lançamento', () => {
    const plan = planSeriesConversion(series, [origin('Planned')], [])

    expect(plan?.recurrence.startDate).toBe('2026-10-15')
    expect(plan?.firstOccurrence).toMatchObject({
      month: '2026-10',
      plannedDate: '2026-10-15',
      plannedAmount: 25_500,
      status: 'Planned',
      entryId: null,
    })
    expect(plan?.removeEntryId).toBe('origin')
  })

  it('Pago: o lançamento fica, e a ocorrência do mês nasce paga apontando para ele', () => {
    const plan = planSeriesConversion(series, [origin('Paid')], [])

    expect(plan?.firstOccurrence).toMatchObject({ status: 'Paid', entryId: 'origin' })
    expect(plan?.removeEntryId).toBeNull()
  })

  it('é idempotente: uma série já convertida não tem origem no mês anterior ao início', () => {
    const converted = { ...series, startDate: isoDate('2026-10-15') }
    expect(planSeriesConversion(converted, [origin('Planned')], [])).toBeNull()
  })

  it('ignora lançamento produzido por "Marcar Pago" (apontado por uma ocorrência)', () => {
    const paidByReview = origin('Paid', '2026-10-15', 'paid-by-review')
    const occurrence = {
      id: 'x',
      recurrenceId: REC,
      month: '2026-10',
      plannedDate: '2026-10-15',
      plannedAmount: cents(25_500),
      status: 'Paid',
      discarded: false,
      entryId: paidByReview.id,
    } as never

    expect(planSeriesConversion(series, [paidByReview], [occurrence])).toBeNull()
  })

  it('não adivinha: duas origens candidatas não convertem nada', () => {
    const plan = planSeriesConversion(
      series,
      [origin('Planned', '2026-10-15', 'a'), origin('Planned', '2026-10-20', 'b')],
      [],
    )
    expect(plan).toBeNull()
  })
})
