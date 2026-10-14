'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/cn'

/**
 * Tabs — the four chips at the top of Novo Lançamento (files_design/01 §5:
 * "4 abas/chips no topo, 1 toque, sem dropdown"). The order is by frequency,
 * not alphabetical: Despesa · Receita · Pró-labore e Distribuição · IR.
 *
 * Styled as files_design/07's "Controle segmentado": a track in
 * `color/bg/subtle`, the selected item raised to `color/bg/card` — the same
 * "depth by lightness, never a shadow" mechanism as the rest of the system.
 * Radix gives arrow-key navigation between tabs, which is what the WAI-ARIA
 * tab pattern requires and what a hand-rolled set of buttons never does.
 */

export const Tabs = TabsPrimitive.Root

export const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'inline-flex items-center gap-4 rounded-control border border-line-default bg-surface-subtle p-4',
        className,
      )}
      {...props}
    />
  )
})

export const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'inline-flex h-[var(--height-control)] items-center rounded-control px-16',
        'text-style-body-md text-ink-secondary transition-colors hover:text-ink-primary',
        // The active segment is signalled by background AND weight, not colour
        // alone (WCAG 1.4.1) — files_design/07, densidade #11.
        'data-[state=active]:bg-surface-card data-[state=active]:font-medium',
        'data-[state=active]:text-ink-primary',
        'disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...props}
    />
  )
})

export const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return <TabsPrimitive.Content ref={ref} className={cn('outline-none', className)} {...props} />
})
