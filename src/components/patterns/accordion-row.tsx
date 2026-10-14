'use client'

import * as React from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDownIcon, ChevronRightIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

/**
 * Linha expansível — files_design/07 §328: "Cabeçalho com título numerado
 * (body.md-medium) + descrição auxiliar (body.md, color/text/secondary) +
 * `icon/chevron-right` (recolhido) ou `icon/chevron-down` (expandido). Recolhido é só o
 * cabeçalho em color/bg/subtle; expandido ganha contorno color/border/default,
 * uma divisória e a área de conteúdo do bloco."
 *
 * Used by Plano de Contas pós-onboarding to hold each bloco's categorias
 * (files_design/01 §10).
 */
export function AccordionRow({
  title,
  description,
  open,
  onOpenChange,
  children,
  className,
}: {
  title: string
  description?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <Collapsible.Root
      open={open}
      onOpenChange={onOpenChange}
      className={cn(
        'rounded-control',
        open ? 'border border-line-default' : 'bg-surface-subtle',
        className,
      )}
    >
      <Collapsible.Trigger
        className={cn(
          'flex w-full items-center gap-12 rounded-control px-16 py-12 text-left outline-none',
          'hover:bg-surface-hover',
          'focus-visible:outline focus-visible:outline-[var(--focus-ring)] focus-visible:outline-line-focus',
          'focus-visible:outline-offset-[calc(var(--focus-offset)*-1)]',
        )}
      >
        {/* Os componentes de ícone do Style guide (masters 470:2 e 470:4),
            não um SVG local: o traçado desenhado à mão aqui era `M5 8l5 5 5-5`
            (10 de largura, de x=5 a x=15), enquanto o `<vector>` do master
            470:3 mede 8×4 em (6,8) — o traçado local era 2 unidades de grade
            mais largo que o do arquivo, de cada lado. */}
        {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
        <span className="flex min-w-0 flex-1 flex-col gap-4">
          <span className="text-style-body-md font-medium text-ink-primary">{title}</span>
          {description ? (
            <span className="text-style-body-md text-ink-secondary">{description}</span>
          ) : null}
        </span>
      </Collapsible.Trigger>
      <Collapsible.Content className="border-t border-line-default px-16 py-12">
        {children}
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
