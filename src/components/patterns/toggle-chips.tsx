'use client'

import { cn } from '@/lib/cn'

export interface ToggleChip {
  readonly key: string
  readonly label: string
  readonly pressed: boolean
}

/**
 * Filtros que se ligam e desligam um a um — "Recorrentes" e "Cartão" do DRE
 * (dono, 2026-10-06). Ao contrário do `SegmentedControl`, nenhum é obrigatório
 * e vários podem estar ligados, então cada um é um botão com `aria-pressed`,
 * não um rádio. O visual é o do trilho do `SegmentedControl` (ligado = fundo
 * de card + borda de controle + peso médio) para que os controles da barra
 * pareçam uma família. NÃO ESTÁ NO FIGMA.
 */
export function ToggleChips({
  chips,
  onToggle,
  'aria-label': ariaLabel,
}: {
  chips: readonly ToggleChip[]
  onToggle: (key: string) => void
  'aria-label': string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-4 rounded-control border border-line-default bg-surface-subtle p-4"
    >
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          aria-pressed={chip.pressed}
          onClick={() => onToggle(chip.key)}
          className={cn(
            'inline-flex h-[var(--height-control)] items-center rounded-control px-16',
            'border border-transparent text-style-body-md text-ink-secondary outline-none transition-colors',
            'hover:bg-surface-hover hover:text-ink-primary',
            'focus-visible:outline focus-visible:outline-[var(--focus-ring)] focus-visible:outline-line-focus',
            'focus-visible:outline-offset-[var(--focus-offset)]',
            'aria-pressed:border-line-control aria-pressed:bg-surface-card aria-pressed:font-medium aria-pressed:text-ink-primary',
          )}
        >
          {chip.label}
        </button>
      ))}
    </div>
  )
}
