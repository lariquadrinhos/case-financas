import { describe, expect, it } from 'vitest'
import { cents } from '@/domain/core'
import { formatMoneyCompact, formatMonths, formatRatio, formatSignedPercent } from './report-format'

function plainSpaces(text: string): string {
  return text.replace(/\u00a0/g, ' ')
}

describe('formatSignedPercent', () => {
  it('shows the dash on null, never a signed dash', () => {
    expect(formatSignedPercent(null)).toBe('—')
  })

  it('always shows a "+" on a positive value', () => {
    expect(formatSignedPercent(1.5)).toBe('+1,5%')
  })

  it('uses the typographic minus "−" on a negative value, not a hyphen', () => {
    expect(formatSignedPercent(-2.1)).toBe('−2,1%')
    expect(formatSignedPercent(-2.1).startsWith('-')).toBe(false)
  })

  it('shows "+0,0%" for exactly zero (zero is not negative)', () => {
    expect(formatSignedPercent(0)).toBe('+0,0%')
  })
})

describe('formatRatio', () => {
  it('one decimal, no unit suffix', () => {
    expect(formatRatio(7)).toBe('7,0')
    expect(formatRatio(2.4)).toBe('2,4')
  })

  it('dash on null', () => {
    expect(formatRatio(null)).toBe('—')
  })
})

describe('formatMonths', () => {
  it('appends " meses" with a space', () => {
    expect(formatMonths(4.2)).toBe('4,2 meses')
  })

  it('dash on null', () => {
    expect(formatMonths(null)).toBe('—')
  })
})

describe('the typographic minus, files_design/08 §1', () => {
  it('formatRatio signs a negative ratio with "−", never the ASCII hyphen', () => {
    expect(formatRatio(-2.4)).toBe('−2,4')
    expect(formatRatio(-2.4).includes('-')).toBe(false)
  })

  it('formatMoneyCompact signs a negative axis label with "−", never the ASCII hyphen', () => {
    expect(plainSpaces(formatMoneyCompact(cents(-2_000_00)))).toBe('−R$ 2.000')
    expect(formatMoneyCompact(cents(-2_000_00)).includes('-')).toBe(false)
  })
})

describe('formatMoneyCompact — files_design/08 §1, the chart-mark exception', () => {
  it('omits cents, unlike formatMoney', () => {
    expect(plainSpaces(formatMoneyCompact(cents(22_400_00)))).toBe('R$ 22.400')
  })

  it('keeps the pt-BR thousands separator', () => {
    expect(plainSpaces(formatMoneyCompact(cents(6_300_00)))).toBe('R$ 6.300')
  })
})
