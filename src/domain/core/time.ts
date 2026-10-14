/**
 * Dates and months — ADR-0001 §2 (cash basis, by payment date).
 *
 * `IsoDate` is always "YYYY-MM-DD" in Brazilian local time, with no clock time
 * and no timezone. The reason: the accounting month of an entry is the month of
 * the payment date THE PERSON entered. Storing a `Date` with a time component
 * reintroduces the classic bug where a payment made on the 1st lands in the
 * previous month because of UTC-3.
 *
 * `Month` is always "YYYY-MM" and is the key of every monthly report.
 */

export type IsoDate = string & { readonly __brand: 'IsoDate' }
export type Month = string & { readonly __brand: 'Month' }

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MONTH_PATTERN = /^\d{4}-\d{2}$/

export function isoDate(value: string): IsoDate {
  if (!DATE_PATTERN.test(value)) {
    throw new Error('time.invalid_date')
  }
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    throw new Error('time.nonexistent_date')
  }
  return value as IsoDate
}

export function month(value: string): Month {
  if (!MONTH_PATTERN.test(value)) {
    throw new Error('time.invalid_month')
  }
  const monthNumber = Number(value.slice(5, 7))
  if (monthNumber < 1 || monthNumber > 12) {
    throw new Error('time.invalid_month')
  }
  return value as Month
}

/** The accounting month of a date. This is the only rule that decides which month an entry lands in. */
export function monthOf(date: IsoDate): Month {
  return date.slice(0, 7) as Month
}

export function yearOf(m: Month): number {
  return Number(m.slice(0, 4))
}

export function monthNumberOf(m: Month): number {
  return Number(m.slice(5, 7))
}

export function addMonths(m: Month, amount: number): Month {
  const total = yearOf(m) * 12 + (monthNumberOf(m) - 1) + amount
  const year = Math.floor(total / 12)
  const number = (total % 12) + 1
  return `${String(year).padStart(4, '0')}-${String(number).padStart(2, '0')}` as Month
}

export function previousMonth(m: Month): Month {
  return addMonths(m, -1)
}

export function nextMonth(m: Month): Month {
  return addMonths(m, 1)
}

export function compareMonths(a: Month, b: Month): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Every month from `from` to `to`, inclusive on both ends. */
export function monthRange(from: Month, to: Month): Month[] {
  if (compareMonths(from, to) > 0) return []
  const months: Month[] = []
  let current = from
  while (compareMonths(current, to) <= 0) {
    months.push(current)
    current = nextMonth(current)
  }
  return months
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function daysInMonth(year: number, monthNumber: number): number {
  if (monthNumber === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
    if (leap) return 29
  }
  return DAYS_IN_MONTH[monthNumber - 1] as number
}

/**
 * The same day-of-month, shifted by N months, clamped to the last day when the
 * target month is shorter. This is the rule behind the recurrence engine and
 * the installment schedule: a recurrence on the 31st falls on Feb 28/29, never
 * on March 3rd.
 */
export function sameDayInAnotherMonth(date: IsoDate, offset: number): IsoDate {
  const day = Number(date.slice(8, 10))
  const target = addMonths(date.slice(0, 7) as Month, offset)
  const finalDay = Math.min(day, daysInMonth(yearOf(target), monthNumberOf(target)))
  return `${target}-${String(finalDay).padStart(2, '0')}` as IsoDate
}

/** Formats for display: `20/07/2026`. */
export function formatDate(date: IsoDate): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`
}

const MONTH_NAMES_PT_BR = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

/** Formats for the month selector, in the product language: `Julho 2026`. */
export function formatMonth(m: Month): string {
  return `${MONTH_NAMES_PT_BR[monthNumberOf(m) - 1]} ${yearOf(m)}`
}

/**
 * The month's name alone, with no year: `Junho`, `Julho`.
 *
 * This is what a sentence about a month spells inside a phrase, where the year
 * is already given by the context: the Consumo Livre history writes "+ Sobra
 * de Junho, adicionada ao saldo" (Figma 345:752, node `192:23`) — `formatMonth`
 * would put "Junho 2026" in the middle of the sentence, which the frame does
 * not spell.
 */
export function formatMonthName(m: Month): string {
  return MONTH_NAMES_PT_BR[monthNumberOf(m) - 1] ?? ''
}

/**
 * The abbreviated month, with no year: `Fev`, `Mar`, `Abr`.
 *
 * This is what a chart axis and a per-month table column print (Figma 23:2,
 * text nodes `23:41`…`23:56` and the header row `23:59`…): a slot is 151px
 * wide there, and `formatMonth`'s `Fevereiro 2026` neither fits nor is what
 * the frame spells. The month selector keeps the long form — same data, two
 * different jobs.
 */
export function formatMonthShort(m: Month): string {
  return MONTH_NAMES_PT_BR[monthNumberOf(m) - 1]?.slice(0, 3) ?? ''
}
