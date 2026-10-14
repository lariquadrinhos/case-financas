'use client'

import { type Month, formatMonth, nextMonth, previousMonth } from '@/domain/core'
import { Button } from '@/components/ui/button'
import { ArrowLeftIcon, ArrowRightIcon } from '@/components/ui/icons'

/**
 * "← Julho 2026 →" — files_design/01 §8.1/§8.4: navigable in both directions,
 * INCLUDING into the future (unlike the wireframe, which only had `←`). A
 * future month shows the Previsto projection instead of failing — there is no
 * upper or lower bound here, the report route itself decides what a month with
 * no data looks like (files_design/08 §6, estado vazio).
 *
 * The arrows are `icon/arrow-left`/`icon/arrow-right` INSTANCES, never text
 * glyphs: Mockup `549:185` lays the selector out as instance `677:6` (20×20) →
 * text `549:187` "Julho 2026" → instance `677:8` (20×20), and files_design/07
 * §"Botão de ícone / quando usar" names "as setas do seletor de mês
 * (`← Julho 2026 →`, DRE e outros relatórios)" as the component's FIRST
 * example — the same wording the Style guide's own caption `537:470` carries.
 * The `←`/`→` in Wireframe `11:28` (texts `11:29`/`11:31`) is the wireframe's
 * grey convention, which spells EVERY icon as a character (the same file draws
 * `↗` at `257:3` for `icon/arrow-diagonal`); for the visual layer,
 * files_design/07 and the Mockup outrank the Wireframe (ADR-0015). Measured
 * before this fix: the DOM shipped `<span aria-hidden="true">←</span>`, a font
 * glyph inheriting the button's `font-size` instead of the library's 20×20 at
 * 1.5px stroke with round caps.
 *
 * The 32×32 container is already right — `variant="text" size="icon"` is the
 * Style guide's Botão de ícone (`532:476`), and the accessible name stays on
 * the button so the SVG can be `aria-hidden`.
 *
 * The three cells are CONTIGUOUS, no `gap`: `398:19` (and its twin `448:71`)
 * lays out "Passo" 44×36 at x=0, "Passo" 100×36 at x=44 and "Passo" 44×36 at
 * x=144 — the 12px breathing room around the arrow and around the label is
 * each cell's own padding, never a gap between siblings. Measured before this
 * fix: `gap-8` on both sides, which pushed the selector to 32+8+88+8+32 = 168.
 * With the gap removed and the label cell at its measured 100px, the selector
 * is 32+100+32 = 164 — exactly the width of the applied instance `549:185`,
 * and the label cell lands on 32→132, the same span the frame reserves.
 */
export function MonthNav({
  month,
  onMonthChange,
}: {
  month: Month
  onMonthChange: (next: Month) => void
}) {
  return (
    <div className="inline-flex items-center">
      <Button
        variant="text"
        size="icon"
        aria-label="Mês anterior"
        onClick={() => onMonthChange(previousMonth(month))}
      >
        <ArrowLeftIcon />
      </Button>
      <span className="min-w-[var(--width-month-label)] text-center text-style-body-md text-ink-primary">
        {formatMonth(month)}
      </span>
      <Button
        variant="text"
        size="icon"
        aria-label="Próximo mês"
        onClick={() => onMonthChange(nextMonth(month))}
      >
        <ArrowRightIcon />
      </Button>
    </div>
  )
}
