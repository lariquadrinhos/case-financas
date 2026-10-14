import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * Card — the layout unit of nearly every screen. files_design/07 "Card":
 * `scale/radius/card`, contorno `color/border/default`, sem sombra —
 * separation is a line, never elevation (densidade #10, modo escuro #3).
 *
 * Only clickable cards get `hover`/`focus` styling (files_design/07: "Use o
 * estado Hover só quando o card inteiro navega pra algum lugar" — a
 * display-only card, the majority, stays in Padrão always). Pass `interactive`
 * for that case; it also renders the `↗` corner cue the doc calls for.
 */
export function Card({
  className,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-card border border-line-default bg-surface-card',
        interactive && 'transition-colors hover:border-line-strong hover:bg-surface-hover',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-4 p-20 pb-12', className)} {...props} />
}

export function CardTitle({
  className,
  level = 2,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { level?: 2 | 3 | 4 }) {
  const Tag = `h${level}` as const
  return <Tag className={cn('text-style-heading-sm text-ink-primary', className)} {...props} />
}

/** The explanatory line that almost every card in the wireframe carries. */
export function CardCaption({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-style-body-sm text-ink-secondary', className)} {...props} />
}

/**
 * `arrow-diagonal` corner cue for a whole-card link (files_design/07, Card:
 * "quando o card inteiro é clicável, ganha um `arrow-diagonal` (↗) de 18×18 no
 * canto superior direito"). The click target stays the card, never this icon
 * alone (same rule as the treemap block, files_design/08 §2.9).
 */
export function CardLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0 text-ink-secondary', className)}
    >
      <path d="M6 12 12 6M7 6h5v5" />
    </svg>
  )
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-20 pt-0', className)} {...props} />
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center gap-8 p-20 pt-0', className)} {...props} />
}
