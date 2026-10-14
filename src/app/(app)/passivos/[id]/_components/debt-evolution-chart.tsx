'use client'

import { type Cents, cents, formatMoney, toReais } from '@/domain/core'
import { LABEL_INSTALLMENT_STATUS } from '@/domain/assets'
import { cn } from '@/lib/cn'
import { sampleDebtEvolution } from '../_lib/debt-chart'
import type { Installment } from '../_lib/queries'

/**
 * "Evolução da Dívida" — files_design/08 §3.6, Figma `91:59`. A single-series
 * bar chart (no charting library, CLAUDE.md §9): the person's own device
 * clock never enters this — "hoje" is derived from which instalments are
 * already Paga, not from a date comparison.
 *
 * Geometry constants below (bar width, axis steps) are literal numbers, not
 * CSS pixels — the same convention `src/components/patterns/treemap.tsx`
 * already established for computed chart geometry (files_design/08's
 * thresholds, e.g. "largura < 120px", are written the same way there).
 */
const BAR_WIDTH = 34
const PLOT_HEIGHT = 144
const AXIS_LABEL_WIDTH = 60
const MIN_VISIBLE_HEIGHT = 3

/** files_design/08 §1: a chart mark's own label drops the cents. */
function formatMoneyNoCents(value: Cents): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(toReais(value))
}

const MONTH_ABBR_PT_BR = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

/** files_design/08 §3.1: smallest step from {1;2;2.5;5}×10ⁿ with `passo·3 ≥ maior·1,05`. */
function axisStep(maxValue: number): number {
  if (maxValue <= 0) return 1
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)))
  const candidates = [1, 2, 2.5, 5].flatMap((base) => [
    base * magnitude,
    base * magnitude * 10,
    (base * magnitude) / 10,
  ])
  const sorted = [...new Set(candidates)].sort((a, b) => a - b)
  return sorted.find((step) => step * 3 >= maxValue * 1.05) ?? sorted[sorted.length - 1]!
}

/**
 * "Ago/25" na primeira barra, "Set" nas seguintes — o ano só reaparece quando
 * muda (Figma `91:59`: Ago/25, Set, Out, Nov, Dez, Jan/26, Fev...).
 */
function monthLabel(date: string, previousYear: string | null): string {
  const [year, month] = date.split('-')
  const abbr = MONTH_ABBR_PT_BR[Number(month) - 1]
  if (previousYear === null || previousYear !== year) {
    return `${abbr}/${year!.slice(2)}`
  }
  return abbr!
}

/**
 * Full "mês/ano" for the tooltip (files_design/08 §3.6: "nome do mês/ano" —
 * unlike the always-visible axis label, the tooltip is a single data point on
 * its own and always names the year, never relying on the previous bar).
 */
function monthYearLabel(date: string): string {
  const [year, month] = date.split('-')
  return `${MONTH_ABBR_PT_BR[Number(month) - 1]}/${year!.slice(2)}`
}

export function DebtEvolutionChart({
  installments,
  monthlyInterestRate,
}: {
  installments: readonly Installment[]
  /** Figma `91:2` nó `91:53`: a taxa vigente do passivo — é ela que desconta a série. */
  monthlyInterestRate: number
}) {
  const points = sampleDebtEvolution(installments, monthlyInterestRate)

  if (points.length === 0) return null

  const maxBalance = Math.max(...points.map((point) => point.balance))
  const step = axisStep(maxBalance)
  const top = step * 3
  const gridLines = [0, step, step * 2, step * 3]

  let previousYear: string | null = null
  const labels = points.map((point) => {
    const year = point.date.slice(0, 4)
    const label = monthLabel(point.date, previousYear)
    previousYear = year
    return label
  })

  return (
    <div className="flex flex-col gap-8">
      <div className="flex" style={{ height: PLOT_HEIGHT + 20 }}>
        <div
          className="flex shrink-0 flex-col justify-between text-right"
          style={{ width: AXIS_LABEL_WIDTH, height: PLOT_HEIGHT }}
        >
          {[...gridLines].reverse().map((value) => (
            <span key={value} className="numeric text-style-label-xs text-ink-tertiary">
              {formatMoneyNoCents(cents(Math.round(value)))}
            </span>
          ))}
        </div>
        <div className="relative flex flex-1 items-end justify-around border-b border-l border-line-strong">
          {gridLines.slice(1).map((value) => (
            <div
              key={value}
              aria-hidden="true"
              className="absolute right-0 left-0 border-t border-line-default"
              style={{ bottom: (value / top) * PLOT_HEIGHT }}
            />
          ))}
          {points.map((point, index) => {
            const rawHeight = (point.balance / top) * PLOT_HEIGHT
            const height = point.balance > 0 ? Math.max(rawHeight, MIN_VISIBLE_HEIGHT) : 0
            return (
              <div
                key={`${point.number}-${point.date}`}
                className="group relative z-10 flex flex-col items-end justify-end"
                style={{ width: BAR_WIDTH, height: PLOT_HEIGHT }}
              >
                {/* files_design/08 §3.6/§3.5: hover activates the whole month
                    slot with the same 8% black multiply overlay as the
                    treemap (src/components/patterns/treemap.tsx), plus a
                    card-style tooltip above the bar — no `pointer` cursor,
                    this mark is not clickable (a parcela ação lives in the
                    "Parcelas" list below, not on the chart). */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/[0.08]"
                />
                {point.isToday ? (
                  <span className="numeric mb-4 w-full text-center text-style-label-xs text-ink-primary">
                    {formatMoneyNoCents(point.balance)}
                  </span>
                ) : null}
                <div
                  role="img"
                  aria-label={`${labels[index]}: saldo devedor ${formatMoney(point.balance)}, parcela ${LABEL_INSTALLMENT_STATUS[point.status]}`}
                  className="w-full rounded-t-control bg-chart-series-1"
                  style={{ height }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-20 hidden -translate-x-1/2 pb-8 group-hover:flex">
                  <div className="flex flex-col gap-4 rounded-control border border-line-default bg-surface-card p-8 whitespace-nowrap">
                    <span className="text-style-label-xs text-ink-secondary">
                      {monthYearLabel(point.date)}
                    </span>
                    <span className="numeric text-style-body-sm text-ink-primary">
                      {formatMoney(point.balance)}
                    </span>
                    <span className="text-style-label-xs text-ink-tertiary">
                      {LABEL_INSTALLMENT_STATUS[point.status]}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ marginLeft: AXIS_LABEL_WIDTH }}>
        <div className="flex justify-around">
          {points.map((point, index) => (
            <span
              key={`${point.number}-label`}
              className={cn(
                'text-center text-style-label-xs',
                point.isToday ? 'text-ink-primary' : 'text-ink-secondary',
              )}
              style={{ width: BAR_WIDTH }}
            >
              {labels[index]}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
