import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

/**
 * Badge — files_design/07 "Etiqueta": exactly four fixed types, never a
 * generic scale, "porque nunca coexistem na mesma etiqueta":
 *   pf/pj      → the low-chroma tag next to an entry's name
 *   previsto   → âmbar, a pending state that "pede ação"
 *   pago       → verde, a resolved state
 *
 * *Quando não usar* (files_design/07): a Etiqueta não é clicável e não vira
 * botão disfarçado — para ação, use Botão Texto ao lado; e não inventar um 5º
 * tipo sem antes definir o par de token correspondente.
 *
 * Note the one documented divergence: in a dense table specifically, "Pago" is
 * shown as quiet grey text instead of this pill (files_design/07, Hierarquia
 * de cor: "'Pago' é rótulo silencioso em cinza terciário") — that is a
 * screen-level choice about which representation to reach for, not a variant
 * of this component.
 */
const variants = cva(
  'inline-flex items-center rounded-pill px-8 py-4 text-style-label-xs whitespace-nowrap',
  {
    variants: {
      tone: {
        pf: 'bg-surface-pf text-ink-pf',
        pj: 'bg-surface-pj text-ink-pj',
        previsto: 'bg-surface-alert text-ink-alert',
        pago: 'bg-surface-positive text-ink-positive',
      },
    },
  },
)

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & Required<VariantProps<typeof variants>>) {
  return <span className={cn(variants({ tone }), className)} {...props} />
}
