'use client'

import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/cn'

/**
 * Switch — files_design/07 "Toggle": trilho 36×20, pílula, círculo branco
 * (`color/bg/card`). Ligado usa `color/text/state` — the same blue as any
 * other active state in the system, not "sim = bom" (it is not `positive`).
 * Desligado usa `color/border/control`. Used for the recurrence toggle and
 * "Definir data de término" (files_design/01 §5.4).
 */
export const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        'inline-flex h-[var(--space-20)] w-[var(--space-40)] shrink-0 items-center',
        'rounded-pill border transition-colors disabled:pointer-events-none disabled:opacity-40',
        // Hover (2026-10-01): o mesmo dimming de 92% do Botão Primário.
        'hover:opacity-[0.92]',
        'data-[state=checked]:border-transparent data-[state=checked]:bg-ink-state',
        'data-[state=unchecked]:border-line-control data-[state=unchecked]:bg-surface-subtle',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'block h-[var(--space-12)] w-[var(--space-12)] rounded-pill bg-surface-card',
          'transition-transform data-[state=checked]:translate-x-[var(--space-20)]',
          'data-[state=unchecked]:translate-x-[var(--space-4)]',
        )}
      />
    </SwitchPrimitive.Root>
  )
})
