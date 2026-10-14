/**
 * Pure rules for the Consumo Livre widget (files_design/08 §9.2), kept apart
 * from the component so they are unit-testable without a DOM.
 */

/**
 * Progress bar fill, as a percentage of the track (0–100).
 *
 * files_design/08 §9.2: "Gasto ultrapassa o limite: a barra preenche 100% do
 * track e para aí (não estoura visualmente pra fora do contêiner)." The text
 * `R$ gasto / R$ limite` keeps showing the real amount elsewhere — this
 * function only ever answers the WIDTH, which must never exceed the track.
 */
export function progressWidthPercent(spentCents: number, limitCents: number): number {
  if (limitCents <= 0) return spentCents > 0 ? 100 : 0
  const ratio = (spentCents / limitCents) * 100
  return Math.max(0, Math.min(100, ratio))
}
