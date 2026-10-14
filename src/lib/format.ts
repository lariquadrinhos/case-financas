import { toReais, type Cents } from '@/domain/core'

/**
 * Small screen-local formatting helpers that do not fit `@/domain/core`
 * (money/date/month formatting for DISPLAY already lives there —
 * `formatMoney`, `formatDate`, `formatMonth`) nor `@/lib/today` (which reads
 * the device clock as branded `IsoDate`/`Month`).
 *
 * `currentIsoDate` is the plain-string counterpart of `@/lib/today`'s
 * `todayIsoDate`, for call sites that only need a `useState` initial value or
 * a request body field and do not want to carry the branded type through.
 */

/**
 * Money without cents — files_design/08 §1, the ONE documented exception to
 * "centavos sempre": "rótulo em cima de barra, valor dentro de bloco de
 * treemap e rótulo de eixo omitem centavos, porque ali o número é pra
 * comparar grandeza, não pra conferir." Never use this for a value in a
 * table — those keep the cents.
 */
export function formatMoneyNoCents(value: Cents): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(toReais(value))
}

/** The current date as "YYYY-MM-DD", from the device clock. */
export function currentIsoDate(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** The current calendar month as "YYYY-MM", from the device clock. */
export function currentMonth(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}
