'use client'

import * as React from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'

/**
 * The discreet "i" beside a field label, which opens a help tooltip on
 * hover/focus. The glyph is the `icon/info` symbol of the Style guide
 * (`470:15`, 20×20 — the native grid of every `icon/*`, measured in `471:17`
 * "cel/info" and confirmed on the Mockup instances, e.g. `877:14`); hence
 * `--size-help-icon`, never the 14×14 badge the Wireframe drew.
 *
 * Wireframe `71:11` "Estado — Tooltips de ajuda" is the source of the
 * behaviour and of the copy, not of the size: hover shows the panel and
 * "Some ao tirar o mouse" (`71:41`), on the four fields whose two options are
 * not self-explanatory from the segment label alone — Status, Classificação,
 * Tipo de valor and Sub-tipo.
 *
 * `width` picks between the two box widths the frame draws, each one equal to
 * the segmented control it explains: the default 332 for the controls of
 * 162+8+162 (Status `71:33` → box `71:38`; Classificação `73:17` → box
 * `73:22`) and `'wide'` = 352 for the controls of 172+8+172 (Tipo de valor
 * `74:20` → box `74:25`; Sub-tipo `78:11` → box `78:16`).
 */
export function InfoTooltip({
  label,
  width = 'default',
  children,
}: {
  label: string
  width?: 'default' | 'wide'
  children: React.ReactNode
}) {
  return (
    /**
     * O Provider vive AQUI, e não em volta de cada tela. Sem ele o Radix lança
     * "`Tooltip` must be used within `TooltipProvider`" — medido —, e isso era
     * uma armadilha: quem acrescentasse o "i" numa tela nova quebrava a tela em
     * vez de receber um aviso. Com o Provider dentro, o componente se basta em
     * qualquer lugar.
     *
     * O que se perde é o `skipDelayDuration` compartilhado: passar o mouse de um
     * "i" para o vizinho reabre a espera de 200ms em vez de abrir na hora. Numa
     * coluna de 18 indicadores isso é preferível — menos balão aparecendo de
     * relance enquanto a pessoa só percorre a lista.
     */
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className={cn(
              'inline-flex h-[var(--size-help-icon)] w-[var(--size-help-icon)] shrink-0',
              'items-center justify-center rounded-pill border border-line-control text-ink-secondary',
              'hover:bg-surface-hover hover:text-ink-primary',
              'focus-visible:outline focus-visible:outline-[var(--focus-ring)]',
              'focus-visible:outline-line-focus focus-visible:outline-offset-[var(--focus-offset)]',
            )}
          >
            {/* Bare SVG units (no "px"), same convention as the sun/moon icons in
              theme-toggle.tsx — the glyph is drawn, not a scaled font size. */}
            <svg aria-hidden="true" width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
              <circle cx="4" cy="1.4" r="1.1" />
              <rect x="3.15" y="3.4" width="1.7" height="4" rx="0.5" />
            </svg>
          </button>
        </TooltipTrigger>
        <TooltipContent className={cn(width === 'wide' && 'w-[var(--width-tooltip-wide)]')}>
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
