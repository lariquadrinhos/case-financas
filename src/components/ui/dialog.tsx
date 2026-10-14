'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/cn'

/**
 * Dialog — o "Diálogo" do Mockup, nó 991:2204 (460×694), com os rodapés do
 * Wireframe 99:63, 94:57, 27:56, 192:47, 192:13 e 345:1256 como conferência.
 *
 * O cabeçalho anterior alegava cobrir "every 'modal sobre Início' and 'modal
 * sobre DRE' frame in the Figma" sem citar UM node id — e três das medidas
 * abaixo não saíam de frame nenhum. Cada uma agora traz a medida que a prendeu.
 *
 * Radix is used rather than a hand-rolled overlay because the three things that
 * make a modal usable are the three that are always got wrong by hand: focus is
 * trapped inside, Escape closes, and the rest of the page is hidden from screen
 * readers. The prototype script (files_design/06) also stacks overlays — Vender
 * Bem Material opens Adicionar Direcionamento on top of it — and Radix handles
 * the stack without duplicating the background.
 */

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

/**
 * Largura, uma por frame — e OBRIGATÓRIA, sem valor implícito.
 *
 * O Figma desenha sete larguras de diálogo (ver `--width-dialog-*` em
 * tokens.css, cada token com o node id de onde saiu a medida). O que existia
 * aqui era `width?: 'default' | 'wide'` com `default` implícito valendo 560px,
 * uma medida que nenhum frame desenha: cinco diálogos herdaram o 560 sem
 * ninguém decidir por eles. Um default silencioso foi a causa do desvio, então
 * não há default — cada chamador declara a largura do SEU frame.
 */
const DIALOG_WIDTH = {
  prompt: 'max-w-[var(--width-dialog-prompt)]',
  compact: 'max-w-[var(--width-dialog-compact)]',
  detail: 'max-w-[var(--width-dialog-detail)]',
  allocation: 'max-w-[var(--width-dialog-allocation)]',
  form: 'max-w-[var(--width-dialog-form)]',
  narrow: 'max-w-[var(--width-dialog-narrow)]',
  wide: 'max-w-[var(--width-dialog-wide)]',
  list: 'max-w-[var(--width-dialog-list)]',
} as const

export type DialogWidth = keyof typeof DIALOG_WIDTH

export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    width: DialogWidth
  }
>(function DialogContent({ className, children, width, ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      {/* O scrim cobre a viewport INTEIRA, barra lateral inclusive — ele não
          acompanha o deslocamento do diálogo abaixo: Wireframe 99:38 é um
          retângulo de 1440×900 em (0,0), irmão do diálogo 99:39. */}
      <DialogPrimitive.Overlay
        className="fixed inset-0 z-50"
        style={{ backgroundColor: 'var(--scrim-overlay)' }}
      />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          // Centralizado na ÁREA DE CONTEÚDO (à direita da barra lateral),
          // nunca na viewport: files_design/07 §10, regra 🟩 com fórmula
          // `x = sidebar + (frame − sidebar − diálogo) / 2`. Era `left-1/2`, o
          // centro da viewport, 136px (= 272/2) à esquerda do desenhado.
          // Medido na Mockup (frames de 1440, "Barra lateral" de 272):
          // 1005:3051 x=616 w=480, 991:2204 x=626 w=460, 997:2505 x=568,5
          // w=575 — e `left-1/2` daria 480, 490 e 432,5. O Wireframe já dizia
          // o mesmo: 99:39 (x=629, w=460) dentro de 99:2 com Sidebar de 278.
          // A barra lateral está presente em toda tela que abre diálogo (todo
          // consumidor de DialogContent vive sob `(app)/layout.tsx`; o
          // Onboarding, que não tem barra lateral, não abre nenhum).
          'fixed left-[calc(50%_+_var(--width-sidebar)/2)] top-1/2 z-50 max-h-[90vh] w-full -translate-x-1/2 -translate-y-1/2',
          // Card mixin, no effect style: files_design/07 process rule #10 — "sem
          // sombra (a biblioteca não tem estilo de efeito nenhum) — flat é a
          // linguagem visual do sistema inteiro".
          'overflow-y-auto rounded-card border border-line-default bg-surface-card',
          DIALOG_WIDTH[width],
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})

/**
 * Mockup 991:2204 → Título 991:2205 em (24,24), 412 de largura, h=52; dentro
 * dele o texto 991:2206 tem h=30 e o subtítulo 991:2207 começa em y=34 → gap 4.
 * O bloco seguinte (Campo 991:2208) começa em y=92, e 24+52=76 → 16 abaixo.
 * Isto JÁ estava certo antes da medição; está anotado para que ninguém
 * "corrija" um valor correto junto com os errados.
 */
export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-4 p-24 pb-16', className)} {...props} />
}

export const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('text-style-heading-sm text-ink-primary', className)}
      {...props}
    />
  )
})

/**
 * Radix warns when a dialog has no description. Every modal in this product has
 * an explanatory line under the title anyway, so the component is required
 * rather than optional — the warning is pointing at a real usability rule.
 */
export const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-style-body-sm text-ink-secondary', className)}
      {...props}
    />
  )
})

/**
 * Mockup 991:2204 — os OITO gaps verticais entre blocos do diálogo medem 16,
 * sem exceção: 76→92, 156→172, 236→252, 296→312, 330→346, 512→528, 580→596,
 * 610→626. Aqui estava `gap-20`, que nenhum dos oito desenha; `--space-20` é
 * inclusive o único da escala marcado `[derived]` em tokens.css, ou seja nem
 * variável do Figma é. Recuo lateral 24: todo filho de 991:2204 está em x=24
 * com 412 de largura (= 460 − 48).
 */
export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-16 px-24', className)} {...props} />
}

/**
 * Rodapé — três medidas, três frames.
 *
 * `pt-16`: Mockup 991:2204, o "* Campo obrigatório" 991:2234 termina em 610 e o
 * Rodapé 991:2235 começa em 626. Era `pt-20`. O resto do `p-24` confere: o
 * Rodapé está em x=24 e termina em 626+44=670, com o frame em 694 (670+24).
 *
 * `gap-12`: Mockup 991:2235 tem dois Botões, 991:2236 em x=0 w=200 e 991:2238
 * em x=212 w=200 → 12 entre eles. Era `gap-8`.
 *
 * `[&>*]:flex-1` em vez de `items-center justify-end`: os botões PARTEM a
 * largura do conteúdo em partes iguais, não se encostam à direita com largura
 * intrínseca. 200 + 12 + 200 = 412, os 412 inteiros. Os seis rodapés que o
 * Wireframe desenha dizem o mesmo — 99:63 (197+10+197=404), 94:57 (idem),
 * 27:56 (254,5+10+254,5=519), 192:47 (177+10+177=364) — e onde há um botão só
 * ele ocupa a linha inteira: 192:13 mede 324 dentro de 324 de conteúdo, e
 * 345:1256 mede 280 dentro de 280. `flex-1` nos filhos desenha os dois casos.
 */
export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center gap-12 p-24 pt-16 [&>*]:flex-1', className)} {...props} />
  )
}
