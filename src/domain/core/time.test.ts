import { describe, expect, it } from 'vitest'
import {
  addMonths,
  compareMonths,
  formatDate,
  formatMonth,
  formatMonthShort,
  isoDate,
  month,
  monthOf,
  monthRange,
  nextMonth,
  previousMonth,
  sameDayInAnotherMonth,
} from './time'

describe('time.isoDate — a date that does not exist is not a date', () => {
  it('rejects the 30th of February', () => {
    expect(() => isoDate('2026-02-30')).toThrow('time.nonexistent_date')
  })

  it('rejects month 13', () => {
    expect(() => isoDate('2026-13-01')).toThrow('time.nonexistent_date')
  })

  it('rejects a malformed string', () => {
    expect(() => isoDate('01/07/2026')).toThrow('time.invalid_date')
    expect(() => isoDate('2026-7-1')).toThrow('time.invalid_date')
  })

  it('accepts the 29th of February in a leap year and rejects it otherwise', () => {
    expect(isoDate('2028-02-29')).toBe('2028-02-29')
    expect(() => isoDate('2027-02-29')).toThrow('time.nonexistent_date')
  })
})

describe('time.monthOf — the only rule that decides the accounting month (PRD §5)', () => {
  it('takes the month straight from the payment date, with no timezone in the way', () => {
    expect(monthOf(isoDate('2026-07-31'))).toBe('2026-07')
    expect(monthOf(isoDate('2026-08-01'))).toBe('2026-08')
  })

  it('puts a payment on the 1st in its own month, not the previous one', () => {
    // The bug this guards against: storing a Date and reading it back in UTC-3
    // moves midnight of the 1st into the last day of the previous month.
    expect(monthOf(isoDate('2026-01-01'))).toBe('2026-01')
  })
})

describe('time.addMonths — crosses the year boundary in both directions', () => {
  it('moves forward across December', () => {
    expect(addMonths(month('2026-11'), 3)).toBe('2027-02')
  })

  it('moves backward across January', () => {
    expect(addMonths(month('2026-02'), -3)).toBe('2025-11')
  })

  it('is the identity for zero', () => {
    expect(addMonths(month('2026-07'), 0)).toBe('2026-07')
  })

  it('agrees with nextMonth and previousMonth', () => {
    expect(nextMonth(month('2026-12'))).toBe('2027-01')
    expect(previousMonth(month('2026-01'))).toBe('2025-12')
  })
})

describe('time.sameDayInAnotherMonth — a recurrence on the 31st (motor de recorrência)', () => {
  it('clamps to the last day of a shorter month instead of overflowing', () => {
    expect(sameDayInAnotherMonth(isoDate('2026-01-31'), 1)).toBe('2026-02-28')
    expect(sameDayInAnotherMonth(isoDate('2026-03-31'), 1)).toBe('2026-04-30')
  })

  it('uses the 29th in a leap year', () => {
    expect(sameDayInAnotherMonth(isoDate('2028-01-31'), 1)).toBe('2028-02-29')
  })

  it('does not clamp when the target month is long enough', () => {
    expect(sameDayInAnotherMonth(isoDate('2026-01-15'), 1)).toBe('2026-02-15')
    expect(sameDayInAnotherMonth(isoDate('2026-01-31'), 2)).toBe('2026-03-31')
  })

  it('clamping is not sticky: after February the original day comes back', () => {
    // A monthly recurrence on the 31st must not degrade to the 28th forever.
    const start = isoDate('2026-01-31')
    expect(sameDayInAnotherMonth(start, 1)).toBe('2026-02-28')
    expect(sameDayInAnotherMonth(start, 2)).toBe('2026-03-31')
  })

  it('walks backwards too', () => {
    expect(sameDayInAnotherMonth(isoDate('2026-03-31'), -1)).toBe('2026-02-28')
  })
})

describe('time.monthRange — inclusive on both ends, empty when reversed', () => {
  it('includes the first and the last month', () => {
    expect(monthRange(month('2026-05'), month('2026-08'))).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
    ])
  })

  it('returns a single month when both ends are equal', () => {
    expect(monthRange(month('2026-05'), month('2026-05'))).toEqual(['2026-05'])
  })

  it('returns an empty list when the start is after the end', () => {
    expect(monthRange(month('2026-08'), month('2026-05'))).toEqual([])
  })
})

describe('time — display formatting stays in the product language', () => {
  it('formats a date as dd/mm/aaaa', () => {
    expect(formatDate(isoDate('2026-07-20'))).toBe('20/07/2026')
  })

  it('formats a month for the selector', () => {
    expect(formatMonth(month('2026-07'))).toBe('Julho 2026')
    expect(formatMonth(month('2026-03'))).toBe('Março 2026')
  })

  // Figma 23:2 spells the Evolução Mensal axis and its table columns "Fev",
  // "Mar", "Abr" — three letters, no year. A chart slot is 151px wide there;
  // `formatMonth`'s long form is a different job, not a longer version of this.
  it('abbreviates to three letters, with no year, for a chart axis or column', () => {
    expect(formatMonthShort(month('2026-02'))).toBe('Fev')
    expect(formatMonthShort(month('2026-07'))).toBe('Jul')
    expect(formatMonthShort(month('2026-12'))).toBe('Dez')
  })

  it('never leaks the year into the short form, in any month', () => {
    for (const number of [1, 5, 9, 11, 12]) {
      const short = formatMonthShort(month(`2026-${String(number).padStart(2, '0')}`))
      expect(short).toHaveLength(3)
      expect(short).not.toContain('2026')
    }
  })

  it('orders months as strings, which is why the format is YYYY-MM', () => {
    expect(compareMonths(month('2026-09'), month('2026-10'))).toBe(-1)
    expect(compareMonths(month('2027-01'), month('2026-12'))).toBe(1)
  })
})
