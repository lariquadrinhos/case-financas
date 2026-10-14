'use client'

import * as React from 'react'
import {
  type Cents,
  type Month,
  type View,
  cents,
  formatMoney,
  formatMonthShort,
} from '@/domain/core'
import { formatMoneyCompact } from '@/lib/report-format'
import {
  type AxisPlan,
  barHeight,
  barTop,
  computeAxisPlan,
  zeroLineY,
} from '@/lib/monthly-trend-chart'

export interface MonthlyTrendBarPoint {
  readonly month: Month
  readonly value: Cents
}

/**
 * files_design/07 "Sistema de gráfico" regra 1 and files_design/08 §3.2, both
 * literal: "Cor de gráfico segue a entidade, nunca a posição. PF é sempre
 * `color/chart/pf` e PJ é sempre `color/chart/pj`."
 *
 * This screen's payload carries one series per Visão rather than a PF/PJ pair
 * (`monthlyTrendSchema`, `src/api/contracts/reports.ts`), so the entity of the
 * bar IS the Visão: switching to PF repaints it `chart/pf`, and only the
 * Consolidado view — which is not an entity — falls back to the neutral
 * single-series token.
 */
const BAR_CLASS_BY_VIEW: Record<View, string> = {
  Consolidated: 'fill-chart-series-1',
  PF: 'fill-chart-pf',
  PJ: 'fill-chart-pj',
}

/**
 * "Lucro Líquido no período selecionado" — files_design/08 §3, adapted to the
 * SINGLE series this screen's real payload is (see the header comment on
 * `src/lib/monthly-trend-chart.ts`). Hand-written SVG, no charting library
 * (this repo's rule for every chart) — the pure geometry lives in
 * `@/lib/monthly-trend-chart`, this component only reads it and draws.
 */
export function MonthlyTrendChart({
  points,
  view,
}: {
  points: readonly MonthlyTrendBarPoint[]
  view: View
}) {
  const barClassName = BAR_CLASS_BY_VIEW[view]
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [tokens, setTokens] = React.useState({
    barWidth: 40,
    plotHeight: 170,
    cornerRadius: 4,
    axisGutter: 60,
  })
  const [containerWidth, setContainerWidth] = React.useState(1026)
  const [hovered, setHovered] = React.useState<number | null>(null)

  // Every raw pixel number below is read from the SAME design tokens
  // `src/styles/tokens.css` defines (`--width-chart-bar`, `--height-chart-plot`,
  // `--radius-treemap-block` — the doc07 "topo arredondado em 4px" rule this
  // chart's marks share with the treemap block) rather than hand-written here.
  React.useEffect(() => {
    const style = getComputedStyle(document.documentElement)
    const px = (name: string, fallback: number) => {
      const raw = style.getPropertyValue(name).trim()
      const parsed = Number.parseFloat(raw)
      return Number.isFinite(parsed) ? parsed : fallback
    }
    setTokens({
      barWidth: px('--width-chart-bar', 40),
      plotHeight: px('--height-chart-plot', 170),
      cornerRadius: px('--radius-treemap-block', 4),
      axisGutter: px('--width-chart-axis-gutter', 60),
    })
  }, [])

  React.useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) setContainerWidth(width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // The month name sits below the plot; `plotTop` is the headroom the value
  // label of the tallest bar and the topmost axis label are drawn into — both
  // used to be painted at a negative `y` and clipped away by the viewBox.
  const labelHeight = tokens.axisGutter / 2
  const plotTop = tokens.axisGutter / 3
  const totalHeight = plotTop + tokens.plotHeight + labelHeight
  const minSlotWidth = tokens.barWidth + tokens.axisGutter
  const plotWidth = Math.max(containerWidth - tokens.axisGutter, minSlotWidth)
  const slotWidth = Math.max(minSlotWidth, plotWidth / Math.max(points.length, 1))
  const totalWidth = tokens.axisGutter + slotWidth * points.length

  if (points.length === 0) return null

  const values = points.map((point) => point.value)
  const allZero = values.every((value) => value === 0)

  if (allZero) {
    return (
      <p className="flex h-[var(--height-chart-plot)] items-center justify-center text-style-body-sm text-ink-secondary">
        Nenhuma variação de Lucro Líquido registrada neste período.
      </p>
    )
  }

  const plan = computeAxisPlan(values)
  const gridLines = buildGridLines(plan, tokens.plotHeight)

  return (
    <div ref={containerRef} className="w-full overflow-x-auto">
      <svg
        role="img"
        aria-label="Gráfico de barras do Lucro Líquido por mês"
        width={totalWidth}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      >
        {/* files_design/08 §3.1, "grade recessiva": default lines, base line
            strong — and the zero line stays strong even when internal
            (a loss month), files_design/08 §3.4. */}
        {gridLines.map((line) => (
          <g key={line.value}>
            <line
              x1={tokens.axisGutter}
              x2={totalWidth}
              y1={plotTop + line.y}
              y2={plotTop + line.y}
              className={line.isZero ? 'stroke-line-strong' : 'stroke-line-default'}
              strokeWidth={1}
            />
            {/* files_design/08 §3.3: "Rótulo de eixo à esquerda, alinhado à
                direita numa coluna", vertically centred on its own grid line.
                The column's width is `--width-chart-axis-gutter`. */}
            <text
              x={tokens.axisGutter - 8}
              y={plotTop + line.y}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-ink-tertiary text-style-label-xs"
            >
              {formatMoneyCompact(cents(Math.round(line.value)))}
            </text>
          </g>
        ))}

        {points.map((point, index) => {
          const slotX = tokens.axisGutter + index * slotWidth
          const barX = slotX + (slotWidth - tokens.barWidth) / 2
          const height = barHeight(point.value, plan, tokens.plotHeight)
          const top = barTop(point.value, plan, tokens.plotHeight)
          const isCurrent = index === points.length - 1
          const isHovered = hovered === index

          return (
            <g
              key={point.month}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered((current) => (current === index ? null : current))}
            >
              {/* Hover target spans the whole month slot, not just the bar —
                  files_design/08 §3.5. */}
              <rect
                x={slotX}
                y={plotTop}
                width={slotWidth}
                height={tokens.plotHeight}
                fill="transparent"
              />
              {height > 0 ? (
                <>
                  <rect
                    x={barX}
                    y={plotTop + top}
                    width={tokens.barWidth}
                    height={height}
                    rx={tokens.cornerRadius}
                    className={barClassName}
                  />
                  {/*
                   * Squares off whichever corners the design does NOT round — the
                   * bottom when the bar sits above zero, the top when a loss bar
                   * hangs below it (files_design/08 §3.2: rounded top, square
                   * bottom, anchored on the baseline).
                   */}
                  <rect
                    x={barX}
                    y={
                      plotTop +
                      (point.value >= 0 ? top + Math.max(height - tokens.cornerRadius, 0) : top)
                    }
                    width={tokens.barWidth}
                    height={Math.min(tokens.cornerRadius, height)}
                    className={barClassName}
                  />
                </>
              ) : null}
              {isHovered ? (
                <rect
                  x={slotX}
                  y={plotTop}
                  width={slotWidth}
                  height={tokens.plotHeight}
                  className="fill-ink-primary"
                  opacity={0.08}
                />
              ) : null}
              {/* files_design/08 §3.3: value label only on the most recent bar,
                  no cents. Month name below every bar; the most recent one in
                  primary ink, the rest secondary. */}
              {isCurrent ? (
                <text
                  x={slotX + slotWidth / 2}
                  y={Math.max(plotTop + top - 6, 10)}
                  textAnchor="middle"
                  className="fill-ink-primary text-style-body-sm font-medium"
                >
                  {formatMoneyCompact(point.value)}
                </text>
              ) : null}
              <text
                x={slotX + slotWidth / 2}
                y={plotTop + tokens.plotHeight + 20}
                textAnchor="middle"
                className={
                  isCurrent
                    ? 'fill-ink-primary text-style-label-xs'
                    : 'fill-ink-secondary text-style-label-xs'
                }
              >
                {formatMonthShort(point.month)}
              </text>
              {isHovered ? (
                <TrendTooltip
                  x={slotX + slotWidth / 2}
                  y={plotTop + Math.min(top, zeroLineY(plan, tokens.plotHeight)) - 12}
                  month={point.month}
                  value={point.value}
                />
              ) : null}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function buildGridLines(
  plan: AxisPlan,
  plotHeight: number,
): { readonly value: number; readonly y: number; readonly isZero: boolean }[] {
  const range = plan.top - plan.bottom
  if (range <= 0) return []
  const toY = (value: number) => ((plan.top - value) / range) * plotHeight

  const lines: { value: number; y: number; isZero: boolean }[] = []
  for (let i = 1; i <= plan.linesAboveZero; i += 1) {
    lines.push({ value: plan.step * i, y: toY(plan.step * i), isZero: false })
  }
  lines.push({ value: 0, y: toY(0), isZero: true })
  for (let i = 1; i <= plan.linesBelowZero; i += 1) {
    lines.push({ value: -plan.step * i, y: toY(-plan.step * i), isZero: false })
  }
  return lines
}

/**
 * files_design/08 §3.5: fundo `color/bg/card`, contorno `color/border/default`,
 * `scale/radius/control`, sem sombra — exact value (with cents), unlike the
 * always-visible label above.
 */
function TrendTooltip({
  x,
  y,
  month,
  value,
}: {
  x: number
  y: number
  month: Month
  value: Cents
}) {
  const width = 160
  const height = 44
  return (
    <foreignObject x={x - width / 2} y={y - height} width={width} height={height}>
      <div className="flex flex-col gap-4 rounded-control border border-line-default bg-surface-card p-8">
        <span className="text-style-label-xs text-ink-secondary">{formatMonthShort(month)}</span>
        <span className="numeric text-style-body-sm text-ink-primary">{formatMoney(value)}</span>
      </div>
    </foreignObject>
  )
}
