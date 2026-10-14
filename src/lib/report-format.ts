/**
 * Number formats specific to the four report screens (DRE, Balanço
 * Patrimonial, Evolução Mensal, Indicadores Financeiros) — files_design/08
 * §1 and §10. `formatMoney`/`formatPercent` (`@/domain/core`) already cover
 * money and the plain percent; this file adds the chart-mark exception to
 * money (§1) and the three formats only the Indicadores catalog uses (§10).
 */

import type { Cents } from '@/domain/core'
import { toReais } from '@/domain/core'

/**
 * files_design/08 §1: "Negativo usa o sinal `−` (menos tipográfico)". `Intl`
 * emits U+002D HYPHEN-MINUS, which is a different character — every formatter
 * in this file goes through `typographicMinus` for the same reason
 * `formatMoney` (`@/domain/core`) does.
 */
function typographicMinus(text: string): string {
  return text.replace('-', '−')
}

/**
 * files_design/08 §1, "Exceção única: dentro de marca de gráfico" — a value
 * drawn ON a bar/axis label omits cents, because it is there to compare
 * magnitude, not to reconcile. A value in a table, even right next to the
 * chart, keeps the cents (`formatMoney`, unchanged).
 */
export function formatMoneyCompact(value: Cents): string {
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(toReais(value))
  return typographicMinus(formatted)
}

/**
 * "Percentual com sinal", only the Crescimento Patrimonial family: `+X,X%` or
 * `−X,X%` (menos tipográfico), sign ALWAYS visible, even on a positive value.
 * `null` (division by zero) still renders the shared dash, never a signed one.
 */
export function formatSignedPercent(percent: number | null, decimals = 1): string {
  if (percent === null) return '—'
  const magnitude = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(percent))
  const sign = percent < 0 ? '−' : '+'
  return `${sign}${magnitude}%`
}

/**
 * "Razão/índice", only the Liquidez family: plain number, 1 decimal, no `%`
 * and no `x` suffix (`7,0`, never `7,0x` nor `700%`).
 */
export function formatRatio(value: number | null, decimals = 1): string {
  if (value === null) return '—'
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
  return typographicMinus(formatted)
}

/** "Meses", only Reserva de emergência: `4,2 meses`, space before the suffix. */
export function formatMonths(value: number | null, decimals = 1): string {
  if (value === null) return '—'
  const number = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
  return `${number} meses`
}
