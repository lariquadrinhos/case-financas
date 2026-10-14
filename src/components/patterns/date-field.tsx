'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * Data — a native `<input type="date">` styled like Campo (files_design/07),
 * with the `icon/calendar` glyph docked at the right edge purely as the visual
 * affordance the Figma draws (`81:38`, `262:873`: "ícone de calendário, busca
 * a data"). The click target stays the native input across its whole box —
 * the browser already opens its own date picker on click/focus, so the icon is
 * decorative (`aria-hidden`), never a second, competing control.
 *
 * A native control over a hand-built calendar grid: keyboard support, locale
 * formatting and the OS picker come for free, and files_design/08 never
 * specifies a calendar-grid algorithm (only the toggle/format rules the
 * `dd/mm/aaaa` mask already covers via the input's own `lang="pt-BR"`).
 */
type CalendarFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>

export const DateField = React.forwardRef<HTMLInputElement, CalendarFieldProps>(
  function DateField(props, ref) {
    return <CalendarField ref={ref} type="date" {...props} />
  },
)

/**
 * O mesmo campo, para escolher um mês ("YYYY-MM") — o "Contabilizar em" da
 * Despesa (dono, 2026-10-06: "melhor ser date picker"). Mesma caixa e mesmo
 * ícone do campo de data, para que os dois leiam como um par.
 */
export const MonthField = React.forwardRef<HTMLInputElement, CalendarFieldProps>(
  function MonthField(props, ref) {
    return <CalendarField ref={ref} type="month" {...props} />
  },
)

const CalendarField = React.forwardRef<
  HTMLInputElement,
  CalendarFieldProps & { type: 'date' | 'month' }
>(function CalendarField({ className, type, ...props }, ref) {
  return (
    <div className="relative">
      <input
        ref={ref}
        type={type}
        lang="pt-BR"
        className={cn(
          'h-[var(--height-field)] w-full rounded-control border border-line-control',
          'bg-surface-card pl-12 pr-40 text-style-body-md text-ink-primary',
          'disabled:pointer-events-none disabled:opacity-40',
          'aria-[invalid=true]:border-line-negative',
          className,
        )}
        {...props}
      />
      <svg
        aria-hidden="true"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-ink-secondary"
      >
        <rect x="3" y="4.5" width="14" height="12.5" rx="1.5" />
        <path d="M3 8.5h14M6.5 2.5v3M13.5 2.5v3" />
      </svg>
    </div>
  )
})
