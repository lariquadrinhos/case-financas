/**
 * Grouped-bar-chart geometry for Evolução Mensal — files_design/08 §3.
 *
 * Pure, framework-free functions (mirrors `src/lib/treemap.ts`'s split between
 * "the math" and "the render") so the axis-step algorithm is unit-testable
 * without touching the DOM. No charting library is used on purpose (this
 * repo's SVG-only rule for every chart) — this hand-implements exactly the
 * rule files_design/08 §3.1 spells out.
 *
 * This screen's real payload (`MonthlyTrend.points`) has no PF/PJ split — see
 * the header comment on `src/lib/reports-client.ts`'s import and
 * `src/api/contracts/reports.ts` `monthlyTrendSchema` — so the bar here is a
 * SINGLE series (Lucro Líquido per month), styled like files_design/08 §3.6's
 * single-series variant (Evolução da Dívida): `color/chart/series-1`, no
 * paired 2px gap.
 */

/** files_design/08 §3.1: the step is the smallest of `{1;2;2,5;5} × 10ⁿ`. */
const AXIS_STEP_BASES = [1, 2, 2.5, 5] as const

/**
 * The smallest step from the closed set such that `step * 3 >= maxMagnitude *
 * 1.05` — the worked example in the doc (maior valor 6.300 → passo 2.500,
 * topo 7.500) is asserted verbatim in this module's test file.
 */
export function computeAxisStep(maxMagnitude: number): number {
  const safeMax = Math.max(maxMagnitude, 1)
  let exponent = Math.floor(Math.log10(safeMax)) - 1
  // 50 iterations comfortably covers any realistic amount of Reais (and then
  // some) without risking an infinite loop if the search is ever fed NaN/Infinity.
  for (let i = 0; i < 50; i += 1) {
    for (const base of AXIS_STEP_BASES) {
      const step = base * 10 ** exponent
      if (step * 3 >= safeMax * 1.05) return step
    }
    exponent += 1
  }
  return safeMax
}

export interface AxisPlan {
  readonly step: number
  /** Grid lines strictly above zero — 3 in the common (all non-negative) case. */
  readonly linesAboveZero: number
  /** files_design/08 §3.4: a loss month extends the SAME step rule below zero. */
  readonly linesBelowZero: number
  readonly top: number
  readonly bottom: number
}

/**
 * files_design/08 §3.1 ("o eixo sempre começa em zero") + §3.4 ("um valor
 * negativo: o eixo estende abaixo de zero com a mesma regra de passo, e a
 * linha do zero passa a ser interna"). Callers must not invoke this with an
 * all-zero series — that is the doc's OWN degenerate case ("todos os valores
 * zero: estado vazio... sem eixo"), handled by the screen before reaching here.
 */
export function computeAxisPlan(values: readonly number[]): AxisPlan {
  const maxPositive = Math.max(0, ...values)
  const maxNegative = Math.max(0, ...values.map((value) => -value))
  const step = computeAxisStep(Math.max(maxPositive, maxNegative))

  // The common case (files_design/08's own example) has no negative value at
  // all, and the formula above guarantees `step * 3` already covers the
  // maximum with its 5% headroom — so the axis keeps the doc's literal "o zero
  // e três passos" shape instead of a smaller, technically-sufficient count.
  const linesAboveZero =
    maxPositive === 0 ? 0 : maxNegative === 0 ? 3 : Math.max(1, Math.ceil(maxPositive / step))
  const linesBelowZero =
    maxNegative === 0 ? 0 : maxPositive === 0 ? 3 : Math.max(1, Math.ceil(maxNegative / step))

  return {
    step,
    linesAboveZero,
    linesBelowZero,
    top: step * linesAboveZero,
    // `+ 0` collapses `-0` to `0` (same fix as `@/domain/core` `negate`):
    // `Object.is(-0, 0)` is false, and an all-positive series must not print a
    // baseline of "-R$ 0,00".
    bottom: -(step * linesBelowZero) + 0,
  }
}

/** files_design/08 §3.6: a non-zero value never disappears at the chart's scale. */
export const MIN_VISIBLE_BAR_HEIGHT = 3

/** The bar's height in SVG units, for a plot area `plotHeight` tall spanning `[bottom, top]`. */
export function barHeight(value: number, plan: AxisPlan, plotHeight: number): number {
  const range = plan.top - plan.bottom
  if (range <= 0) return 0
  const raw = (Math.abs(value) / range) * plotHeight
  if (value === 0) return 0
  return Math.max(raw, MIN_VISIBLE_BAR_HEIGHT)
}

/** The bar's top y (SVG, y grows downward) for a plot area `plotHeight` tall. */
export function barTop(value: number, plan: AxisPlan, plotHeight: number): number {
  const range = plan.top - plan.bottom
  if (range <= 0) return 0
  const zeroY = (plan.top / range) * plotHeight
  return value >= 0 ? zeroY - barHeight(value, plan, plotHeight) : zeroY
}

/** The y (SVG) of the zero baseline, for the internal divider line when the axis extends below zero. */
export function zeroLineY(plan: AxisPlan, plotHeight: number): number {
  const range = plan.top - plan.bottom
  if (range <= 0) return plotHeight
  return (plan.top / range) * plotHeight
}
