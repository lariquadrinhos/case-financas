'use client'

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/cn'

/**
 * Tooltip — Figma `71:11` "Estado — Tooltips de ajuda (Status, Classificação,
 * Tipo de valor, Sub-tipo)": hover the "i" beside a field's label, a small card
 * appears with the two/four option meanings spelled out, and disappears when
 * the mouse leaves ("① Normal: 'i' discreto ao lado do rótulo" · "② Hover:
 * tooltip aparece... Some ao tirar o mouse").
 *
 * Card mixin (`bg-surface-card`, `border-line-default`, `radius-card`, no
 * shadow — files_design/07 densidade #10) rather than a new surface style.
 *
 * A largura é FIXA (`--width-tooltip`), não `max-w`: no frame as quatro caixas
 * são retângulos de largura declarada (`71:38`/`73:22` w=332,
 * `74:25`/`78:16` w=352), e com `max-w` a caixa curta de Classificação
 * (`73:22`, uma linha de 202px de texto) encolheria até o conteúdo em vez de
 * ocupar os 332 desenhados. Quem precisa da caixa larga passa
 * `w-[var(--width-tooltip-wide)]` por `className` — o `cn()` resolve o
 * conflito do grupo `w` a favor da última classe.
 */
export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent({ className, sideOffset = 6, ...props }, ref) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-[var(--width-tooltip)] rounded-card border border-line-default bg-surface-card',
          'p-12 text-style-body-sm text-ink-secondary',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
})
