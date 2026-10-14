import { describe, expect, it } from 'vitest'
import { cents } from '@/domain/core'
import type { Indicator } from '@/domain/reports'
import { formatIndicatorValue } from './indicator-format'

/** `Intl` separates "R$" from the digits with a NON-BREAKING space (U+00A0). */
function plainSpaces(text: string): string {
  return text.replace(/\u00a0/g, ' ')
}

function percentIndicator(value: number | null): Indicator {
  return { key: 'grossMargin', label: 'Margem bruta', unit: '%', value }
}

describe('formatIndicatorValue — files_design/08 §10', () => {
  it('shows a dash, never "NaN%" nor "0%", when the value is null (division by zero)', () => {
    expect(formatIndicatorValue(percentIndicator(null), 'Profitability')).toBe('—')
  })

  it('formats a plain percentage with 1 decimal, comma, no sign', () => {
    expect(formatIndicatorValue(percentIndicator(87.5), 'Profitability')).toBe('87,5%')
  })

  it('signs a Crescimento Patrimonial percentage even when positive', () => {
    const indicator: Indicator = {
      key: 'netWorthGrowth',
      label: 'Crescimento do PL (mês)',
      unit: '%',
      value: 1.5,
    }
    expect(formatIndicatorValue(indicator, 'NetWorthGrowth')).toBe('+1,5%')
  })

  it('signs a Crescimento Patrimonial percentage with the typographic minus when negative', () => {
    const indicator: Indicator = {
      key: 'investmentGrowth',
      label: 'Crescimento dos investimentos (mês)',
      unit: '%',
      value: -2.1,
    }
    expect(formatIndicatorValue(indicator, 'NetWorthGrowth')).toBe('−2,1%')
  })

  it('does NOT sign a percentage outside Crescimento Patrimonial, even with the same unit', () => {
    // Same shape/value as the signed case above, different family — regression
    // guard for the one rule files_design/08 §10 calls out as the exception.
    const indicator: Indicator = {
      key: 'debtRatio',
      label: 'Grau de endividamento',
      unit: '%',
      value: 1.5,
    }
    expect(formatIndicatorValue(indicator, 'Leverage')).toBe('1,5%')
  })

  it('formats a ratio (Liquidez) with no % and no "x" suffix', () => {
    const indicator: Indicator = {
      key: 'currentRatio',
      label: 'Liquidez corrente',
      unit: 'x',
      value: 7,
    }
    expect(formatIndicatorValue(indicator, 'Liquidity')).toBe('7,0')
  })

  it('formats months with the " meses" suffix', () => {
    const indicator: Indicator = {
      key: 'emergencyReserve',
      label: 'Reserva de emergência',
      unit: 'months',
      value: 4.2,
    }
    expect(formatIndicatorValue(indicator, 'FinancialQualityOfLife')).toBe('4,2 meses')
  })

  it('formats a BRL indicator with the full formatMoney precision (cents included)', () => {
    const indicator: Indicator = {
      key: 'monthlyCostOfLiving',
      label: 'Custo de vida mensal',
      unit: 'BRL',
      value: cents(550_000),
    }
    const formatted = formatIndicatorValue(indicator, 'FinancialQualityOfLife')
    expect(plainSpaces(formatted)).toBe('R$ 5.500,00')
  })
})
