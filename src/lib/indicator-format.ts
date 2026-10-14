/**
 * Indicadores Financeiros — value formatting, files_design/08 §10 "Formato
 * por tipo" + "Casos degenerados". Pure so the two rules most likely to be
 * gotten wrong — "division by zero shows a dash, never NaN/0%" and "signed
 * percent is exclusive to Crescimento Patrimonial" — are unit-testable without
 * rendering the page.
 */

import { type Cents, formatMoney, formatPercent } from '@/domain/core'
import type { Indicator, IndicatorFamily } from '@/domain/reports'
import { formatMonths, formatRatio, formatSignedPercent } from '@/lib/report-format'

/**
 * `null` (division by zero, files_design/08 §10) always renders the shared
 * dash — checked FIRST, before any unit-specific branch, so no unit format
 * ever gets a chance to turn `null` into `"NaN%"` or `"0%"`.
 *
 * Cor: never semantic — this returns TEXT only, never a colour class. Not
 * even Crescimento Patrimonial's sign implies red/green (files_design/08 §10:
 * "Cor: nunca semântica, sempre color/text/primary").
 */
export function formatIndicatorValue(indicator: Indicator, family: IndicatorFamily): string {
  if (indicator.value === null) return '—'
  switch (indicator.unit) {
    case 'BRL':
      return formatMoney(indicator.value as Cents)
    case 'x':
      return formatRatio(indicator.value)
    case 'months':
      return formatMonths(indicator.value)
    case '%':
      // "Percentual com sinal, só na família Crescimento Patrimonial" —
      // files_design/08 §10. Every other percent family uses the plain form.
      return family === 'NetWorthGrowth'
        ? formatSignedPercent(indicator.value)
        : formatPercent(indicator.value, 1)
  }
}
