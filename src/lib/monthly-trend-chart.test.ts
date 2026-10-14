import { describe, expect, it } from 'vitest'
import {
  barHeight,
  barTop,
  computeAxisPlan,
  computeAxisStep,
  zeroLineY,
} from './monthly-trend-chart'

describe('computeAxisStep — files_design/08 §3.1', () => {
  it("matches the doc's own worked example: maior valor 6.300 → passo 2.500", () => {
    expect(computeAxisStep(6300)).toBe(2500)
  })

  it('always leaves at least 5% headroom above the maximum (step * 3 >= max * 1.05)', () => {
    for (const max of [1, 42, 999, 6300, 50_000, 1_234_567]) {
      const step = computeAxisStep(max)
      expect(step * 3).toBeGreaterThanOrEqual(max * 1.05 - 1e-9)
    }
  })

  /**
   * The assertion above is satisfied by most maxima whether or not the 5%
   * exists, because the step set is coarse: for a value like 6.300 the next
   * step up already clears 1,05× on its own. The cases that actually PROVE the
   * headroom are the ones sitting exactly ON a grid top — there, dropping the
   * `* 1,05` changes the answer and the bar would touch the ceiling, which is
   * the single thing files_design/08 §3.1 says the folga exists to prevent.
   */
  it('pushes a maximum that lands exactly on a grid top up to the next step', () => {
    // 7.500 = 2.500 × 3: without the folga, 2.500 would be chosen and the
    // tallest bar would reach the topmost grid line.
    expect(computeAxisStep(7500)).toBe(5000)
    expect(computeAxisStep(3000)).toBe(2000)
    expect(computeAxisStep(300)).toBe(200)
  })

  it('only ever returns a step from the closed set {1;2;2,5;5} × 10ⁿ', () => {
    const bases = [1, 2, 2.5, 5]
    for (const max of [3, 17, 250, 4100, 89_000]) {
      const step = computeAxisStep(max)
      // `step / base` must be an exact power of 10 for at least one base.
      const matches = bases.some((base) => {
        const exponent = Math.log10(step / base)
        return Number.isInteger(Math.round(exponent * 1e6) / 1e6)
      })
      expect(matches).toBe(true)
    }
  })
})

describe('computeAxisPlan — files_design/08 §3.1 (all non-negative) and §3.4 (a loss month)', () => {
  it('the axis always starts at zero: the common case gets exactly 3 lines above it', () => {
    const plan = computeAxisPlan([1000, 4500, 6300, 2000])
    expect(plan.linesAboveZero).toBe(3)
    expect(plan.linesBelowZero).toBe(0)
    expect(plan.bottom).toBe(0)
    expect(plan.top).toBe(plan.step * 3)
  })

  it('extends below zero, with the SAME step, when a month is a loss', () => {
    const plan = computeAxisPlan([6300, -1500])
    expect(plan.linesBelowZero).toBeGreaterThan(0)
    expect(plan.bottom).toBeLessThan(0)
    // Same step size governs both directions (files_design/08 §3.4).
    expect(plan.bottom % plan.step).toBeCloseTo(0, 6)
  })
})

describe('barHeight/barTop — geometry', () => {
  it('a zero-value point has zero height (nothing drawn)', () => {
    const plan = computeAxisPlan([1000, 0, 500])
    expect(barHeight(0, plan, 170)).toBe(0)
  })

  it('a small non-zero value is never shorter than MIN_VISIBLE_BAR_HEIGHT (files_design/08 §3.6)', () => {
    const plan = computeAxisPlan([1_000_000, 1])
    expect(barHeight(1, plan, 170)).toBeGreaterThanOrEqual(3)
  })

  it('a positive bar sits above the zero line; its top is above (smaller y than) the baseline', () => {
    const plan = computeAxisPlan([1000, 2000])
    const zero = zeroLineY(plan, 170)
    expect(barTop(1000, plan, 170)).toBeLessThan(zero)
  })

  it('a negative bar hangs BELOW the (now internal) zero line, not above it', () => {
    const plan = computeAxisPlan([1000, -400])
    const zero = zeroLineY(plan, 170)
    expect(barTop(-400, plan, 170)).toBe(zero)
    expect(barTop(-400, plan, 170) + barHeight(-400, plan, 170)).toBeGreaterThan(zero)
  })
})
