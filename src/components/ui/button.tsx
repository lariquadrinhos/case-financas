'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

/**
 * Button — files_design/07 "Botão": three styles, never two of the same
 * weight side by side.
 *   primary   → the action that completes the flow ("Salvar Lançamento", "Concluir")
 *   secondary → an equally available action ("Editar", "Analisar", "Avançar")
 *   text      → no box at all: icon buttons and disclosure toggles only
 *
 * A row-level action inside a list or card ("Editar", "Marcar Pago",
 * "Descartar") is `secondary` + `size="compact"` since 2026-10-01 — as plain
 * text it did not read as a button (owner's request).
 *
 * files_design/01 §12 is explicit: on the Detalhe do Passivo screen the two
 * header actions carry the SAME weight — neither is "more important". Use
 * `secondary` for both there, never `primary` for one of them.
 *
 * Text is always `body.md-medium` (files_design/07, Tipografia: "botão" is
 * the documented use of that style) — size and weight do not change with
 * `size`, only the control's height and padding do.
 */
const variants = cva(
  'inline-flex items-center justify-center gap-8 whitespace-nowrap rounded-control ' +
    'text-style-body-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 ' +
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Hover: opacity 92% — "dimming sutil, coerente com sem sombra".
        primary:
          'bg-surface-inverse text-ink-inverse hover:opacity-[0.92] border border-transparent',
        secondary:
          'bg-surface-card text-ink-primary border border-line-control hover:bg-surface-hover',
        text: 'bg-transparent text-ink-primary border border-transparent hover:bg-surface-hover',
      },
      size: {
        // A ÚNICA altura de botão que o Figma desenha: 44px. Style guide
        // 458:26, os 12 símbolos btn/* (458:2 … 458:24) medem 72×44, sem
        // exceção; o Mockup aplica o mesmo (CTA da barra lateral 936:1550,
        // 240×44; rodapé do Onboarding 1 988:2080/988:2083/988:2085).
        // Antes daqui saía `--height-control` (32px) — que é a caixa do Botão
        // de ícone (532:467, 32×32), não a do Botão — e todo botão do produto
        // ficava 12px baixo demais.
        default: 'h-[var(--height-button)] px-16',
        // Mesma altura; só o respiro horizontal muda. É o CTA "+ Novo
        // Lançamento" da barra lateral (files_design/07, Barra lateral). O
        // valor anterior, 43px de `--height-action`, vinha do Wireframe 26:28,
        // onde TODO controle é um traço cinza de altura uniforme; o Mockup
        // desenha esse mesmo botão com 44 em 936:1550.
        large: 'h-[var(--height-button)] px-24',
        // Ação de linha (pedido do dono, 2026-10-01: "Marcar pago, Descartar e
        // Editar não parecem um botão"). Secundário com contorno, mas na altura
        // do Botão de ícone — 44 dobraria a linha da tabela. Diverge do Style
        // guide (458:26 só desenha 44); pendente de design.
        compact: 'h-[var(--height-control)] px-12',
        // Botão de ícone: 32×32 container, ícone 20×20 centralizado dentro
        // (Style guide 532:476, símbolos 532:467/470/473; files_design/07 §292).
        icon: 'h-[var(--height-control)] w-[var(--height-control)] p-0',
      },
      width: { auto: '', full: 'w-full' },
    },
    defaultVariants: { variant: 'secondary', size: 'default', width: 'auto' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> {
  /** Render as the child (e.g. a `<Link>`) while keeping the styling. */
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, width, asChild = false, type, ...props },
  ref,
) {
  const Component = asChild ? Slot : 'button'
  return (
    <Component
      ref={ref}
      // A button inside a form with no explicit `type` submits by accident — a
      // classic bug in a long form like Novo Lançamento.
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(variants({ variant, size, width }), className)}
      {...props}
    />
  )
})
