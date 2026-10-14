'use client'

import * as React from 'react'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { cn } from '@/lib/cn'

/**
 * Segmented control — files_design/07 "Controle segmentado": choice between 2
 * or 3 mutually-exclusive options, always one selected, never an empty state.
 * Used for Entidade (PF/PJ), Classificação (circulante/não circulante) and Tipo
 * de Direcionamento (Investimento/Passivo/Receita).
 *
 * Built on Radix RadioGroup rather than a row of buttons: the options ARE
 * mutually exclusive with one always active, which is exactly the radio-group
 * semantics (arrow-key roving between segments, one name for the group).
 *
 * "Trilho em color/bg/subtle, item selecionado ganha fundo color/bg/card" — the
 * same depth-by-lightness mechanism as Tabs (which the style guide names as the
 * SAME component when used for a 2-3 way view switch).
 */
export interface SegmentedControlOption<T extends string> {
  readonly value: T
  readonly label: string
}

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  id,
  fullWidth = false,
  'aria-describedby': describedBy,
  'aria-label': ariaLabel,
  className,
}: {
  value: T
  onValueChange: (value: T) => void
  options: readonly SegmentedControlOption<T>[]
  id?: string
  /** Passivos' "Classificação (sugerida)" spans the whole field width (Figma
   * 95:47: two segments of 347 across 700); Entidade never does. */
  fullWidth?: boolean
  'aria-describedby'?: string
  /** The group's accessible name, for the common case of no adjacent visible
   * `<Label htmlFor>` — e.g. a report screen's Consolidado/PF/PJ switch, which
   * reads on its own with no separate label element (files_design/01 §8). */
  'aria-label'?: string
  className?: string
}) {
  return (
    <RadioGroupPrimitive.Root
      id={id}
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      aria-describedby={describedBy}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-4 rounded-control border border-line-default bg-surface-subtle p-4',
        fullWidth && 'flex w-full',
        className,
      )}
    >
      {options.map((option) => (
        <RadioGroupPrimitive.Item
          key={option.value}
          value={option.value}
          className={cn(
            'inline-flex h-[var(--height-control)] items-center rounded-control px-16',
            // Dono, 2026-10-01: selecionado e hover somem no claro (card × trilho
            // = 1,09:1). Duas propriedades por estado (files_design/07, densidade
            // nº 11): selecionado = fundo de card + borda de controle (3:1 contra o
            // trilho) + peso médio; hover = fundo de hover + texto primário. O texto
            // azul foi testado e revertido no mesmo dia ("fora do padrão visual").
            'border border-transparent text-style-body-md text-ink-secondary outline-none transition-colors',
            'hover:bg-surface-hover hover:text-ink-primary',
            'focus-visible:outline focus-visible:outline-[var(--focus-ring)] focus-visible:outline-line-focus',
            'focus-visible:outline-offset-[var(--focus-offset)]',
            'data-[state=checked]:bg-surface-card data-[state=checked]:font-medium',
            'data-[state=checked]:border-line-control data-[state=checked]:text-ink-primary',
            fullWidth && 'flex-1 justify-center',
          )}
        >
          {option.label}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  )
}
