import { describe, expect, it } from 'vitest'
import { formatPercentText, parsePercentText } from './percent-input'

/**
 * "Taxa de juros (a.m.)" is typed as a percentage ("0,85") and stored as the
 * decimal fraction `monthlyRateSchema` wants (0.0085). Both Passivos screens —
 * the onboarding step and the post-onboarding cadastro — go through these two
 * functions, so the field and the wire value can never drift apart by rounding
 * differently in two places.
 */
describe('parsePercentText', () => {
  it('parses a pt-BR comma decimal into the fraction the API stores', () => {
    expect(parsePercentText('0,85')).toBeCloseTo(0.0085)
  })

  it('parses a whole number percent', () => {
    expect(parsePercentText('1')).toBeCloseTo(0.01)
  })

  it('answers null for an empty field, so a required rate cannot be submitted as 0%', () => {
    expect(parsePercentText('')).toBeNull()
  })

  it('answers null for text that is not a number, instead of silently becoming 0%', () => {
    expect(parsePercentText('abc')).toBeNull()
  })

  it('answers null for a negative rate', () => {
    expect(parsePercentText('-1')).toBeNull()
  })
})

describe('formatPercentText', () => {
  it('formats the stored fraction back as a pt-BR comma percent', () => {
    expect(formatPercentText(0.0085)).toBe('0,85')
  })

  it('round-trips through parsePercentText without drifting', () => {
    const original = '0,85'
    const parsed = parsePercentText(original)
    expect(parsed).not.toBeNull()
    expect(formatPercentText(parsed as number)).toBe(original)
  })
})
