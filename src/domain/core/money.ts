/**
 * Money — ADR-0001 §5.
 *
 * A monetary amount is ALWAYS an integer number of cents, never a float of
 * reais. This is a measured decision, not an aesthetic one: `0.1 + 0.2 !== 0.3`
 * in floating point, and the income statement sums dozens of entries before the
 * result is compared against the balance sheet. One cent of drift per sum
 * becomes a visible discrepancy in the monthly reconciliation.
 *
 * The UI accepts what the person types (digits entering right to left, the
 * active-mask convention from files_design/03); the domain only knows cents.
 */

export type Cents = number & { readonly __brand: 'Cents' }

export const ZERO = 0 as Cents

export function cents(value: number): Cents {
  if (!Number.isFinite(value)) {
    throw new Error('money.invalid_amount')
  }
  if (!Number.isInteger(value)) {
    throw new Error('money.not_an_integer')
  }
  return value as Cents
}

/** Converts reais (e.g. 1520.5) to cents, rounding half up. */
export function fromReais(reais: number): Cents {
  if (!Number.isFinite(reais)) {
    throw new Error('money.invalid_amount')
  }
  return Math.round(reais * 100) as Cents
}

export function toReais(value: Cents): number {
  return value / 100
}

export function add(...values: readonly Cents[]): Cents {
  return values.reduce<number>((total, v) => total + v, 0) as Cents
}

export function subtract(a: Cents, b: Cents): Cents {
  return (a - b + 0) as Cents
}

/**
 * `+ 0` is not decoration: `-0` is a real value in JavaScript, `Object.is(-0, 0)`
 * is false, and `Intl` formats it as "-R$ 0,00". An empty DRE line would print a
 * negative zero. Adding zero collapses `-0` to `0` and leaves every other value
 * untouched.
 */
export function negate(value: Cents): Cents {
  return (-value + 0) as Cents
}

export function isNegative(value: Cents): boolean {
  return value < 0
}

export function isZero(value: Cents): boolean {
  return value === 0
}

/**
 * Multiplies by a rate (e.g. monthly interest 0.0085), rounding to the nearest
 * cent. Used by the amortization schedule (ADR-0005 §4).
 */
export function multiply(value: Cents, factor: number): Cents {
  if (!Number.isFinite(factor)) {
    throw new Error('money.invalid_factor')
  }
  // `+ 0` for the same reason as in `negate`: Math.round(-0.2) is -0.
  return (Math.round(value * factor) + 0) as Cents
}

/**
 * `part` as a percentage of `total`, in percentage points (e.g. 46.2).
 * Returns `null` when the total is zero — the UI shows a dash, never "NaN%"
 * and never "0%", which would be two different lies.
 */
export function percentOf(part: Cents, total: Cents): number | null {
  if (total === 0) return null
  return (part / total) * 100
}

/**
 * Splits `value` into `parts` shares, distributing the remainder one cent at a
 * time from the first share onwards. The shares always sum back to the total —
 * an invariant the amortization schedule and the profit allocation rely on.
 */
export function splitEvenly(value: Cents, parts: number): Cents[] {
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new Error('money.invalid_part_count')
  }
  const base = Math.trunc(value / parts)
  const remainder = value - base * parts
  const sign = remainder >= 0 ? 1 : -1
  return Array.from(
    { length: parts },
    (_, i) => (base + (i < Math.abs(remainder) ? sign : 0)) as Cents,
  )
}

/**
 * Formats for display in pt-BR: `R$ 1.520,00`.
 *
 * files_design/08 §1: "Negativo usa o sinal `−` (menos tipográfico) antes do
 * `R$`, e nunca parênteses nem cor." `Intl` emits U+002D HYPHEN-MINUS, which
 * is a different character — replaced here so every screen gets the sign the
 * design system specifies, in the one place money becomes text.
 */
const HYPHEN_MINUS = '-'
const TYPOGRAPHIC_MINUS = '−'

export function formatMoney(value: Cents): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
    .format(toReais(value))
    .replace(HYPHEN_MINUS, TYPOGRAPHIC_MINUS)
}

/**
 * Formats a percentage for display: `46%`. `null` renders as an em dash.
 *
 * The sign rule of files_design/08 §1 is not about money specifically — it is
 * about every negative number this product prints ("Negativo usa o sinal `−`
 * (menos tipográfico)"). `Intl` emits U+002D HYPHEN-MINUS here just as it does
 * for currency, so the same substitution `formatMoney` makes applies.
 */
export function formatPercent(percent: number | null, decimals = 0): string {
  if (percent === null) return '—'
  return `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
    .format(percent)
    .replace(HYPHEN_MINUS, TYPOGRAPHIC_MINUS)}%`
}
