'use client'

import { Button } from '@/components/ui/button'
import { formatMonth, nextMonth, previousMonth, type Month, type View } from '@/domain/core'
import { cn } from '@/lib/cn'

const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: 'Consolidated', label: 'Consolidado' },
  { value: 'PF', label: 'PF' },
  { value: 'PJ', label: 'PJ' },
]

/**
 * Controle segmentado (files_design/07) para Consolidado/PF/PJ, mais o
 * seletor de mês navegável (← Mês →) — o mesmo par de controles do DRE,
 * files_design/01 §4: "Entradas e Saídas ... com seletor de mês e as 3
 * visões".
 */
export function MonthViewToolbar({
  month,
  view,
  onMonthChange,
  onViewChange,
}: {
  month: Month
  view: View
  onMonthChange: (month: Month) => void
  onViewChange: (view: View) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-16">
      <div
        role="tablist"
        aria-label="Visão"
        className="inline-flex items-center gap-4 rounded-control border border-line-default bg-surface-subtle p-4"
      >
        {VIEW_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={view === option.value}
            onClick={() => onViewChange(option.value)}
            className={cn(
              'inline-flex h-[var(--height-control)] items-center rounded-control px-16',
              'text-style-body-md text-ink-secondary transition-colors hover:text-ink-primary',
              view === option.value && 'bg-surface-card font-medium text-ink-primary',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/*
       * Seletor de mês — Mockup 398:19 / 448:71: três células "Passo"
       * contíguas, 44 | 100 | 44. O respiro de 12 em volta da seta e do
       * rótulo é padding de cada célula, nunca `gap` entre irmãos.
       * Ver src/components/patterns/month-nav.tsx.
       */}
      <div className="inline-flex items-center">
        <Button
          size="icon"
          aria-label="Mês anterior"
          onClick={() => onMonthChange(previousMonth(month))}
        >
          ←
        </Button>
        <span className="min-w-[var(--width-month-label)] text-center text-style-body-md text-ink-primary">
          {formatMonth(month)}
        </span>
        <Button
          size="icon"
          aria-label="Próximo mês"
          onClick={() => onMonthChange(nextMonth(month))}
        >
          →
        </Button>
      </div>
    </div>
  )
}
