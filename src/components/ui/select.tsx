'use client'

import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { fieldControlClassName } from './input'
import { cn } from '@/lib/cn'

/**
 * Select — o campo de referência (Conta, Investimento, Passivo, Categoria de
 * um bloco). NÃO é um componente inventado por analogia: o design o desenha, e
 * o desenha como o Campo.
 *
 * Página Mockup, `872:1305` "Modal — Novo Lançamento": o campo Conta é o nó
 * `877:19`, que o Figma reporta como `<instance name="Campo">`, 432×64 — a
 * mesma instância que Valor (`872:1359`), Data de pagamento (`872:1363`) e
 * Categoria (`877:3`) usam. Internos: rótulo `I877:19;460:4` 432×18 em y=0,
 * caixa `I877:19;460:5` 432×40 em y=24, texto `I877:19;460:6` em x=12/y=10.
 * Por isso o gatilho reusa `fieldControlClassName` em vez de reescrever a
 * altura, a borda e o raio: assim `field/focus` (`460:7`) e `field/error`
 * (`460:11`) valem aqui pela mesma definição que vale no Campo.
 *
 * O rótulo, a linha de mensagem de erro e o `aria-invalid` que aciona
 * `field/error` (a variante que cresce de 64 para 88) vêm do `Field`
 * (`./field.tsx`), que envolve todo uso deste componente.
 *
 * O texto do placeholder é literal do frame: `6:79` "Selecionar conta…" na
 * página Wireframe (`262:873`) e `103:34` "Clique para ver a lista de
 * investimentos…" em `103:21`.
 */
export const Select = SelectPrimitive.Root

export const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & { placeholder?: string }
>(function SelectTrigger({ className, children, placeholder, ...props }, ref) {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        fieldControlClassName,
        // O botão precisa centrar o texto na vertical, coisa que o `input` faz
        // sozinho; nada além disso muda em relação ao Campo.
        'flex items-center text-left',
        // Hover (2026-10-01): o mesmo fundo sutil do Botão Secundário.
        'hover:bg-surface-hover',
        'data-[placeholder]:text-ink-tertiary',
        className,
      )}
      {...props}
    >
      {/* Aqui havia um chevron: um `<svg>` de 12×12 desenhado à mão, com o
          gatilho em `justify-between` para empurrá-lo à direita. Nenhum frame o
          desenha. O screenshot renderizado de `877:19` (Mockup) mostra a caixa
          de "Conta *" com "Selecionar conta…" e NADA à direita, e o wireframe
          `6:78` (424×40, texto `6:79` em x=14) também não traz glifo — embora o
          campo vizinho de Data de pagamento (`6:49`, 424×42) CARREGUE o ícone
          de calendário `201:2`, 18×18, em x=392. O wireframe desenha ícone
          quando quer um; a ausência em `6:78` é decisão, não omissão. */}
      {/* O valor escolhido também fica numa linha: um nome longo estourava a caixa. */}
      <span className="min-w-0 truncate">
        <SelectPrimitive.Value placeholder={placeholder} />
      </span>
      {children}
    </SelectPrimitive.Trigger>
  )
})

/**
 * A lista aberta da Conta não é desenhada em nenhuma das cinco páginas do
 * arquivo (busca por "Selecionar conta" na página Mockup: zero resultado; os
 * nós "Lista" 805:265 e 983:1763 são tabelas do Histórico e do Onboarding 2).
 * O único estado aberto desenhado é o do outro campo de referência, o combobox
 * de Categoria: Wireframe `47:2` "Estado — Buscar/Criar Categoria (expandido)",
 * subárvore `83:4`, 340×274 — gatilho `83:5` 340×40, divisória `83:7`, cabeçalho
 * `83:8` 340×24, lista `83:10` 340×**174** com itens `83:11`..`83:29` de
 * 340×**29** cada, e a linha de vazio `47:22` 340×**31**.
 *
 * Esta lista é, então, um empréstimo EXPLÍCITO daquela geometria — declarado
 * aqui em vez de medido, porque medida própria não existe — e usa exatamente os
 * mesmos tokens que `SearchCreateField` (`--height-dropdown-max`,
 * `--height-dropdown-row`, `--height-dropdown-empty`), para que os dois campos
 * de referência do produto não abram duas listas de tamanhos diferentes.
 */
export const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(function SelectContent({ className, children, position = 'popper', ...props }, ref) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        sideOffset={4}
        className={cn(
          'z-50 w-[var(--radix-select-trigger-width)] overflow-hidden',
          'rounded-card border border-line-default bg-surface-card',
          className,
        )}
        {...props}
      >
        {/* A altura máxima era `var(--width-dialog)` — um token de LARGURA
            (560) usado como altura — e depois
            `--radix-select-content-available-height`, que é o espaço até a
            borda da viewport, não uma medida de design. `83:10` mede 174: seis
            linhas de 29 visíveis, com a barra de rolagem `219:2` ao lado. */}
        <SelectPrimitive.Viewport className="max-h-[var(--height-dropdown-max)] p-4">
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
})

export const SelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(function SelectItem({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        // `83:11`..`83:29` medem 29 de altura, não os 32 de `--height-control`
        // (que é o token do Controle segmentado, outro componente).
        'flex h-[var(--height-dropdown-row)] cursor-pointer select-none items-center',
        'rounded-control px-12 text-style-body-md text-ink-primary outline-none',
        'data-[highlighted]:bg-surface-subtle',
        'data-[state=checked]:bg-surface-state data-[state=checked]:text-ink-state',
        className,
      )}
      {...props}
    >
      {/* Uma linha só, com reticências. A altura da linha é fixa (`83:11`..`83:29`
          medem 29), e um rótulo longo quebrava em duas ou três linhas e invadia a
          opção vizinha — medido em 2026-09-29 com o nome de produto que o banco
          informa ("Nu Pagamentos S.A. - Instituição de Pagamento (Conta
          Pré-paga)"). O texto inteiro fica no `title`. */}
      <span
        className="min-w-0 truncate"
        title={typeof children === 'string' ? children : undefined}
      >
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      </span>
    </SelectPrimitive.Item>
  )
})

/** Wireframe `47:22`: a linha de vazio é uma LINHA de 31 de altura, com o mesmo
 *  inset das outras linhas da lista — não um parágrafo de padding arbitrário. */
export function SelectEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p
      className={cn(
        'flex h-[var(--height-dropdown-empty)] items-center px-12',
        'text-style-body-sm text-ink-secondary',
      )}
    >
      {children}
    </p>
  )
}

/**
 * Divide a lista em dois grupos — no card Open Finance, as posições existentes
 * das ações ("Criar nova…", "Desvincular"). Não desenhado no Figma; usa a
 * espessura e a cor de linha que a borda da própria lista já usa.
 */
export function SelectSeparator({ className }: { className?: string }) {
  return (
    <SelectPrimitive.Separator
      className={cn('mx-4 my-4 h-[var(--stroke-hairline)] bg-line-default', className)}
    />
  )
}
