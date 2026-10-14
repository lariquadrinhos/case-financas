import { describe, expect, it } from 'vitest'
import {
  ZERO,
  add,
  cents,
  formatMoney,
  formatPercent,
  fromReais,
  isNegative,
  multiply,
  negate,
  percentOf,
  splitEvenly,
  subtract,
  toReais,
} from './money'

/**
 * `Intl` separates "R$" from the digits with a NON-BREAKING space (U+00A0).
 * Comparing against a literal typed with a normal space fails on a difference
 * nobody can see in the diff, so the escape is spelled out here once.
 */
function plainSpaces(text: string): string {
  return text.replace(/\u00a0/g, ' ')
}

describe('money — integer cents (ADR-0001 §5)', () => {
  it('rejects a non-integer, because a fraction of a cent is not money', () => {
    expect(() => cents(10.5)).toThrow('money.not_an_integer')
  })

  it('rejects NaN and Infinity', () => {
    expect(() => cents(Number.NaN)).toThrow('money.invalid_amount')
    expect(() => cents(Number.POSITIVE_INFINITY)).toThrow('money.invalid_amount')
  })

  it('survives the classic floating point sum: 0.1 + 0.2 is 30 cents, not 30.000000000000004', () => {
    expect(fromReais(0.1 + 0.2)).toBe(30)
  })

  it('round-trips reais through cents', () => {
    expect(toReais(fromReais(1520.5))).toBe(1520.5)
  })

  it('adds without drift across many entries', () => {
    const oneCent = cents(1)
    const total = add(...Array.from({ length: 1000 }, () => oneCent))
    expect(total).toBe(1000)
  })

  it('subtracts into negative territory, because a loss is a real result', () => {
    const result = subtract(cents(1000), cents(2500))
    expect(result).toBe(-1500)
    expect(isNegative(result)).toBe(true)
    expect(negate(result)).toBe(1500)
  })
})

describe('money — negative zero never escapes (a DRE line must not print "-R$ 0,00")', () => {
  // Found by the income-statement tests: `-value` on a zero produces `-0`,
  // `Object.is(-0, 0)` is false, and Intl formats it with a minus sign. Every
  // empty subtracting block in the cascade goes through `negate`.
  it('negate(0) is +0, not -0', () => {
    expect(Object.is(negate(ZERO), 0)).toBe(true)
  })

  it('multiply(0, rate) is +0, not -0', () => {
    expect(Object.is(multiply(ZERO, 0.0085), 0)).toBe(true)
    expect(Object.is(multiply(cents(1), -0.2), 0)).toBe(true)
  })

  it('subtract of two equal amounts is +0, not -0', () => {
    expect(Object.is(subtract(cents(500), cents(500)), 0)).toBe(true)
  })

  it('formats a zero without a minus sign', () => {
    expect(plainSpaces(formatMoney(negate(ZERO)))).toBe('R$ 0,00')
  })

  it('still negates a real value', () => {
    expect(negate(cents(1500))).toBe(-1500)
    expect(negate(cents(-1500))).toBe(1500)
  })
})

describe('money.multiply — used by the amortization schedule (ADR-0005 §4)', () => {
  it('rounds to the nearest cent', () => {
    // 152000 cents at 0.85% monthly = 1292.0 cents exactly
    expect(multiply(cents(152_000), 0.0085)).toBe(1292)
    // 333 cents at 1/3 = 111.0
    expect(multiply(cents(333), 1 / 3)).toBe(111)
    // 100 cents at 1/3 = 33.33 -> 33
    expect(multiply(cents(100), 1 / 3)).toBe(33)
  })

  it('rejects a non-finite factor', () => {
    expect(() => multiply(cents(100), Number.NaN)).toThrow('money.invalid_factor')
  })
})

describe('money.percentOf — a zero denominator is a dash, never NaN and never 0%', () => {
  it('returns null when the total is zero', () => {
    expect(percentOf(cents(500), ZERO)).toBeNull()
    expect(formatPercent(percentOf(cents(500), ZERO))).toBe('—')
  })

  it('computes the share otherwise', () => {
    expect(percentOf(cents(2500), cents(10_000))).toBe(25)
  })
})

/**
 * files_design/08 §1: "Negativo usa o sinal `−` (menos tipográfico)". The rule
 * is about every negative number the product prints, not only money — a
 * negative indicator ("Endividamento sobre PL") reaches the screen through
 * `formatPercent`, and `Intl` emits U+002D HYPHEN-MINUS for both.
 */
describe('money.formatPercent — the sign is the typographic minus', () => {
  it('uses "−" (U+2212) on a negative percentage, never the ASCII hyphen', () => {
    expect(formatPercent(-132.8, 1)).toBe('−132,8%')
    expect(formatPercent(-132.8, 1).includes('-')).toBe(false)
  })

  it('leaves a positive percentage unsigned', () => {
    expect(formatPercent(87.5, 1)).toBe('87,5%')
  })
})

describe('money.splitEvenly — the parts always sum back to the total', () => {
  it('distributes the remainder one cent at a time', () => {
    const parts = splitEvenly(cents(100), 3)
    expect(parts).toEqual([34, 33, 33])
    expect(add(...parts)).toBe(100)
  })

  it('handles a total smaller than the number of parts', () => {
    const parts = splitEvenly(cents(1), 3)
    expect(parts).toEqual([1, 0, 0])
    expect(add(...parts)).toBe(1)
  })

  it('keeps the invariant for a negative total', () => {
    const parts = splitEvenly(cents(-100), 3)
    expect(add(...parts)).toBe(-100)
  })

  it('keeps the invariant across many awkward totals', () => {
    for (let total = -50; total <= 50; total += 1) {
      for (let n = 1; n <= 7; n += 1) {
        expect(add(...splitEvenly(cents(total), n))).toBe(total)
      }
    }
  })

  it('rejects a non-positive or fractional part count', () => {
    expect(() => splitEvenly(cents(100), 0)).toThrow('money.invalid_part_count')
    expect(() => splitEvenly(cents(100), 2.5)).toThrow('money.invalid_part_count')
  })
})

describe('money.formatMoney — pt-BR display', () => {
  it('formats with the Brazilian thousands separator and comma', () => {
    // Intl uses a non-breaking space after "R$"; compare on normalised text.
    expect(plainSpaces(formatMoney(cents(152_000)))).toBe('R$ 1.520,00')
  })

  it('formats zero as the mask resting state', () => {
    expect(plainSpaces(formatMoney(ZERO))).toBe('R$ 0,00')
  })

  // files_design/08 §1: "Negativo usa o sinal − (menos tipográfico) antes do
  // R$". `Intl` emits U+002D HYPHEN-MINUS; the doc asks for U+2212. Asserted on
  // the code point, because the two characters are near-indistinguishable in a
  // diff and a string literal here would silently accept the wrong one.
  it('formats a loss with the TYPOGRAPHIC minus (U+2212), never an ASCII hyphen', () => {
    const formatted = plainSpaces(formatMoney(cents(-1500)))
    expect(formatted).toBe('−R$ 15,00')
    expect(formatted.codePointAt(0)).toBe(0x2212)
    expect(formatted).not.toContain('-')
  })
})
