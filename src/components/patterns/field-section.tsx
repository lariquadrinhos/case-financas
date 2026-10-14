import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * A named group of fields inside a dense form — files_design/01 §5:
 * "cada aba organiza os campos em blocos com título pequeno em caixa alta +
 * linha divisória entre eles" (Despesa/Receita: Informações Básicas →
 * Categorização → Recorrência; Pró-labore: … → Transferência → Recorrência).
 *
 * The divider is the section's OWN top border, not a `<hr>` between sections,
 * so the first section in a form never draws an orphan line above it.
 */
export function FieldSection({
  title,
  children,
  className,
  first = false,
}: {
  title: string
  children: React.ReactNode
  className?: string
  first?: boolean
}) {
  return (
    <section
      className={cn(
        'flex flex-col gap-16',
        !first && 'border-t border-line-default pt-24',
        className,
      )}
    >
      <h3 className="text-style-label-xs text-ink-secondary">{title}</h3>
      <div className="flex flex-col gap-16">{children}</div>
    </section>
  )
}
