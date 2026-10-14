import { suggestClassification } from '@/domain/chart-of-accounts'
import type { Classification } from '@/domain/core'

/**
 * Drives the "Classificação (sugerida)" segmented control as the person types
 * "Nome" — files_design/01 §3.5: "sugerida automaticamente por palavra-chave,
 * editável". `suggestClassification` (src/domain/chart-of-accounts/rules.ts)
 * is a suggestion and "never an imposition"; this function adds the one rule
 * that keeps it that way once the person has acted: once they have picked a
 * side of the segmented control themselves (`touched: true`), a further edit
 * to the name must NEVER silently flip their choice back — the classification
 * they is chose is the one the record keeps, and only clicking the segmented
 * control again changes it.
 *
 * Before the field is touched, the suggestion follows the name live, and
 * falls back to `NonCurrent` when no keyword matches — the same default
 * `newLiabilitySchema` carries at the API boundary
 * (src/api/contracts/liabilities.ts), so the value shown on screen is never
 * out of step with what would be saved if the person submitted right now.
 */
export function nextClassification({
  name,
  touched,
  current,
}: {
  name: string
  touched: boolean
  current: Classification
}): Classification {
  if (touched) return current
  return suggestClassification(name) ?? 'NonCurrent'
}
