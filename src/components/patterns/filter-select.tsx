'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * A compact filter dropdown — files_design/01 §7 "Histórico": "Filtros:
 * status · entidade · mês · categoria · classificação · conta · recorrência".
 * Each filter always includes a "Todos" option that clears it, which is why
 * this is a NATIVE `<select>` rather than the `Select` built on Radix: Radix's
 * `Select.Item` refuses an empty-string `value` outright, and "no filter" is
 * exactly the empty string this screen's query-building already treats as
 * "omit this param" (`src/features/historico/use-historico.ts`).
 */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly { value: string; label: string }[]
  className?: string
}) {
  return (
    <label className="flex flex-col gap-4">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'h-[var(--height-control)] rounded-control border border-line-control',
          'bg-surface-card px-8 text-style-body-sm text-ink-primary',
          className,
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
