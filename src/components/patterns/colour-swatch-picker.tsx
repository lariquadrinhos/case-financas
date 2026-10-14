'use client'

import * as React from 'react'
import * as Popover from '@radix-ui/react-popover'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { cn } from '@/lib/cn'
import {
  BANK_ACCOUNT_SWATCHES,
  BANK_EXTRA_SWATCHES,
  BANK_SUGGESTION_SWATCHES,
  type BankAccountSwatch,
} from '@/lib/bank-account-colours'

/** As que a faixa já mostra: para elas, o gatilho não vira cor. */
const SUGGESTION_SLUGS = new Set<string>(BANK_SUGGESTION_SWATCHES.map((s) => s.slug))

/**
 * The "Cor" picker of the Contas Bancárias form. The control IS drawn, in four
 * frames across both Figma pages, with closed geometry: Mockup `1111:8`/
 * `1111:10` (Desktop — Onboarding 2, claro) and `921:40`/`921:42` (Desktop —
 * Contas Bancárias, claro); Wireframe `36:2`/`36:4` inside `29:39` and
 * `332:115`/`332:117` inside `332:2` (docs/figma/frames/*.xml). All four
 * measure the same: six 28×28 ellipses at x=0/40/80/120/160/200 inside a
 * 228px-wide container.
 *
 * Hence `gap-12`, not a chosen-by-taste value: step 40 − circle 28 = 12, and
 * 6×28 + 5×12 = 228 closes on the frame's own width. `gap-8` measured
 * 6×28 + 5×8 = 208px — 20px narrower than every frame that draws this row.
 * One row, no `flex-wrap`: 228px is a fixed strip in all four frames.
 *
 * A radio group rather than six toggles because the choice is mutually
 * exclusive with one always selected (files_design/03 exception 3), and
 * because no library component covers it: the Style guide `383:2` has no
 * colour selector, its Controle segmentado says outright "QUANDO NÃO USAR:
 * mais de 3 opções (vira lista/dropdown)", and the Toggle is for a binary.
 * So this is a screen-local control, by the design's own inventory.
 *
 * THE SELECTED STATE IS NOT A GAP IN THE DESIGN — an earlier version of this
 * file claimed it was and drew a check mark of its own invention. `921:42`
 * draws it. Measured pixel by pixel on the node's native 228×28 render, centre
 * row y=14:
 *
 *   x=0..1   #d3d7da  ← 2px ring, circle 1 (selected)
 *   x=2..25  #820ad1  ← Nubank fill, nothing drawn inside it
 *   x=26..27 #d3d7da
 *   x=40     #e6e8ea  ← 1px stroke, circle 2
 *   x=41..66 #ec7000
 *
 * and the same 1px #e6e8ea on circles 3..6. #d3d7da is `--color-border-strong`,
 * #e6e8ea is `--color-border-default`. Sweeping the whole interior of circle 1
 * (x 4..23 × y 4..23) returns only the purple, the ring grey and the antialias
 * between them — no light pixel anywhere, so there is no check mark: selection
 * is the ring, and only the ring.
 *
 * The 2px focus ring stays a separate thing (files_design/07 §Foco): it is an
 * `outline` outside the box, so it never competes with the selection border.
 *
 * Swatches come from `@/lib/bank-account-colours` — the one place the slug ↔
 * hex mapping is defined, shared with whatever screen later reads
 * `BankAccount.colour` back (the Home's "Onde Está Meu Dinheiro"), so the two
 * never disagree about what a stored slug means.
 */
export function ColourSwatchPicker({
  swatches,
  value,
  onValueChange,
  id,
  'aria-describedby': describedBy,
  'aria-label': ariaLabel,
}: {
  swatches: readonly BankAccountSwatch[]
  value: BankAccountSwatch['slug']
  onValueChange: (value: BankAccountSwatch['slug']) => void
  id?: string
  'aria-describedby'?: string
  /** The group's accessible name: a `<label htmlFor>` cannot name a
   * `div[role=radiogroup]`, so the visible "Cor" label has to be repeated here
   * or the group reaches a screen reader unnamed. */
  'aria-label'?: string
}) {
  return (
    <RadioGroupPrimitive.Root
      id={id}
      aria-describedby={describedBy}
      aria-label={ariaLabel}
      value={value}
      /* Radix types the callback as `(value: string) => void`, but it only ever
         emits the `value` of an Item rendered above — every one of them is a
         slug of the closed palette (Figma Tokens `1091:2`). */
      onValueChange={(next) => onValueChange(next as BankAccountSwatch['slug'])}
      className="flex items-center gap-12"
    >
      {swatches.map((swatch) => (
        <RadioGroupPrimitive.Item
          key={swatch.slug}
          value={swatch.slug}
          aria-label={swatch.label}
          style={{ backgroundColor: `var(${swatch.cssVariable})` }}
          className={cn(SWATCH_BASE, SWATCH_SELECTION, FOCUS_RING)}
        />
      ))}

      {/* A 6ª vaga: o gatilho do color pick, no lugar onde o cinza ficava.
          Decidido em 2026-09-11 — o cinza parecia uma cor escolhível quando na
          verdade significava "nenhuma das cinco". */}
      <ColourPickTrigger value={value} onValueChange={onValueChange} />
    </RadioGroupPrimitive.Root>
  )
}

/* -------------------------------------------------------------------------
 * O gatilho do color pick
 * ---------------------------------------------------------------------- */

// Hover (2026-10-01): o mesmo dimming de 92% do Botão Primário.
const SWATCH_BASE =
  'h-[var(--size-swatch)] w-[var(--size-swatch)] rounded-pill hover:opacity-[0.92]'
// 921:42: 1px #e6e8ea em todo círculo, 2px #d3d7da no selecionado.
const SWATCH_SELECTION = cn(
  'border-[length:var(--stroke-hairline)] border-line-default',
  'data-[state=checked]:border-[length:var(--stroke-swatch-selected)]',
  'data-[state=checked]:border-line-strong',
)
const FOCUS_RING = cn(
  'outline-none focus-visible:outline focus-visible:outline-[var(--focus-ring)]',
  'focus-visible:outline-line-focus focus-visible:outline-offset-[var(--focus-offset)]',
)

/**
 * A 6ª vaga da faixa, e a razão de ela existir.
 *
 * **Fechado, sem cor extra escolhida:** círculo tracejado, sem preenchimento,
 * com um `+`. Tracejado e vazio porque ele precisa parecer clicável SEM parecer
 * uma cor — era esse o defeito do cinza, que se lia como "escolha cinza" quando
 * queria dizer "nenhuma das cinco".
 *
 * **Fechado, com cor extra escolhida:** o círculo VIRA aquela cor, **continua
 * tracejado** (agora com 2px, que é o estado selecionado) e **mantém o `+` no
 * centro**.
 *
 * Duas tentativas anteriores caíram, e o registro importa para ninguém refazer:
 *
 * 1. Um `+` num selo no canto. Desenhado, o selo mede 10 de largura num círculo
 *    de 28 — uma mordida visível, disputando atenção com a própria cor.
 * 2. Tirar o `+` e deixar só o tracejado. Foi o que ficou publicado por um dia,
 *    e **a pessoa que usa o app reparou na falta**: o tracejado sozinho não diz
 *    que aquilo abre alguma coisa.
 *
 * O `+` volta ao centro, sobre a cor, com o tom vindo do CONTRASTE MEDIDO de
 * cada cor (`plusInk` em @/lib/bank-account-colours): claro por padrão, escuro
 * só onde o claro fica abaixo de 3:1 — hoje, só o ouro. Ele não usa
 * `--color-text-inverse` de propósito: aquele inverte com o tema, e estas cores
 * não.
 *
 * A regra do anel fica assim, e é aprendível:
 *   sólido 1px          uma cor, não selecionada
 *   sólido 2px forte    uma cor, selecionada
 *   tracejado 1px       o color pick, sem cor extra escolhida
 *   tracejado 2px forte o color pick, carregando a cor escolhida
 *
 * A faixa segue honesta sobre a cor da conta sem expulsar nenhum banco — a
 * alternativa considerada, empurrar a cor escolhida para a 1ª vaga, tirava o
 * Nubank e obrigava a abrir o color pick para recuperar a cor mais comum.
 *
 * **Aberto:** só as SEIS extras. As cinco de banco ficaram de fora numa
 * reversão de 2026-09-11, olhando o desenho: repetidas dentro da janela elas
 * poluíam, e não se ganha nada com isso — o painel abre ABAIXO do gatilho, então
 * a faixa continua visível acima dele. Quem quer Nubank não precisa fechar a
 * janela: a bolinha está à vista, um clique adiante.
 */
function ColourPickTrigger({
  value,
  onValueChange,
}: {
  value: BankAccountSwatch['slug']
  onValueChange: (value: BankAccountSwatch['slug']) => void
}) {
  const [open, setOpen] = React.useState(false)
  const escolhida = BANK_ACCOUNT_SWATCHES.find((s) => s.slug === value)
  const ehExtra = escolhida !== undefined && !SUGGESTION_SLUGS.has(escolhida.slug)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={
            ehExtra ? `Cor: ${escolhida.label}. Escolher outra cor` : 'Escolher outra cor'
          }
          style={ehExtra ? { backgroundColor: `var(${escolhida.cssVariable})` } : undefined}
          className={cn(
            SWATCH_BASE,
            FOCUS_RING,
            'flex items-center justify-center',
            ehExtra ? null : 'text-ink-secondary',
            // Tracejado sempre: é o que distingue esta vaga das cinco cores.
            'border-dashed',
            ehExtra
              ? 'border-[length:var(--stroke-swatch-selected)] border-line-strong'
              : 'border-[length:var(--stroke-hairline)] border-line-control',
          )}
        >
          {/* O `+` está SEMPRE aqui: sem ele, nada diz que a vaga abre algo. */}
          <span
            aria-hidden="true"
            className="pointer-events-none text-style-body-sm leading-none"
            style={
              ehExtra
                ? { color: `var(--bank-account-plus-${escolhida.plusInk ?? 'light'})` }
                : undefined
            }
          >
            +
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className={cn(
            'z-50 rounded-card border border-line-default bg-surface-card p-12',
            'w-[var(--width-colour-pick)]',
          )}
        >
          <RadioGroupPrimitive.Root
            aria-label="Todas as cores"
            value={value}
            onValueChange={(next) => {
              onValueChange(next as BankAccountSwatch['slug'])
              // Escolher fecha: foi o pedido, e evita a janela ficar aberta
              // sobre uma faixa que já mostra o resultado.
              setOpen(false)
            }}
            /* Seis numa linha só, a mesma aritmética da faixa:
               6 × 28 + 5 × 12 = 228. */
            className="flex items-center gap-12"
          >
            {BANK_EXTRA_SWATCHES.map((swatch) => (
              <RadioGroupPrimitive.Item
                key={swatch.slug}
                value={swatch.slug}
                aria-label={swatch.label}
                style={{ backgroundColor: `var(${swatch.cssVariable})` }}
                className={cn(SWATCH_BASE, SWATCH_SELECTION, FOCUS_RING)}
              />
            ))}
          </RadioGroupPrimitive.Root>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
