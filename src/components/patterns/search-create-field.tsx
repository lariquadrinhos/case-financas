'use client'

import * as React from 'react'
import * as Popover from '@radix-ui/react-popover'
import { cn } from '@/lib/cn'

/**
 * "Buscar e Criar" — the pattern files_design/02 documents once and reuses for
 * every reference field that also lets the person create what is missing:
 * categoria (Plano de Contas, Novo Lançamento) and, per files_design/03
 * "Objeto Direcionamento", o destino de um Investimento dentro de Vender Bem
 * Material ("mesmo padrão de busca/criar categoria").
 *
 * Behaviour, from `src/domain/chart-of-accounts/rules.ts` (`searchCategories`)
 * and files_design/02: the full list shows as soon as the field is focused,
 * before any typing; typing filters by substring; an exact-name match never
 * offers "+ Criar" again (no duplicate).
 *
 * This component is generic UI only — the filtering itself is the caller's
 * (e.g. `searchCategories` for categorias, so the exact same normalisation the
 * server uses for the duplicate check also drives what the screen offers).
 */
export interface SearchCreateItem {
  readonly id: string
  readonly label: string
}

export function SearchCreateField({
  items,
  query,
  onQueryChange,
  onSelect,
  onCreate,
  placeholder = 'Buscar…',
  createLabel,
  listHeading,
  emptyLabel = 'Nenhum resultado encontrado.',
  createHint,
  listHint,
  closeOnCreate = true,
  id,
  'aria-describedby': describedBy,
  disabled,
}: {
  /** Already filtered by the caller for the current `query`. */
  items: readonly SearchCreateItem[]
  query: string
  onQueryChange: (query: string) => void
  onSelect: (item: SearchCreateItem) => void
  /** Omit to disable creation — a pure search field. */
  onCreate?: (name: string) => void
  placeholder?: string
  createLabel?: (term: string) => string
  /**
   * Wireframe `47:2` (`83:9` / `47:21`): o cabeçalho em caixa alta acima da
   * lista — "CATEGORIAS EXISTENTES" no campo Categoria. Opcional porque o
   * frame só o desenha nesse dropdown; os outros usos (destino de Investimento
   * / Passivo) não têm frame com cabeçalho.
   */
  listHeading?: string
  /** Wireframe `47:2` (`47:23`): a linha de lista vazia, com a palavra do frame. */
  emptyLabel?: string
  /**
   * Wireframe `47:2` (`84:2`): a segunda linha da MESMA linha de criação —
   * "Categorias parecidas neste bloco: …". É o que faz `47:25` medir 52 em vez
   * dos 35 de `83:62`.
   */
  createHint?: string
  /**
   * Uma linha de apoio logo abaixo do cabeçalho, dentro do dropdown. Desenhada
   * no Mockup "Desktop — Novo Lançamento (criar categoria: escolher bloco)",
   * onde o passo de escolher bloco precisa dizer que a escolha é irreversível.
   * O dropdown de categoria não a usa — o cabeçalho dele se explica sozinho.
   */
  listHint?: string
  /**
   * Criar sempre fechou o dropdown, e isso deixou de ser verdade quando a
   * criação ganhou um segundo passo: no Novo Lançamento, "+ Criar categoria"
   * abre a escolha de bloco DENTRO do mesmo painel (P34). Fechar ali cancelaria
   * o fluxo na cara da pessoa.
   */
  closeOnCreate?: boolean
  id?: string
  'aria-describedby'?: string
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  // Dentro de um modal, a lista abre NO modal, não no <body>. O bloqueio de
  // rolagem do Dialog (react-remove-scroll) cancela todo evento de roda fora do
  // DOM do modal — medido em 2026-09-23: `defaultPrevented` em 100% dos `wheel`
  // sobre a lista, e o trackpad não rolava nada. Fora de modal (Plano de Contas)
  // `closest` devolve null e o portal volta ao <body>.
  const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(null)
  function openList() {
    setPortalContainer(inputRef.current?.closest<HTMLElement>('[role="dialog"]') ?? null)
    setOpen(true)
  }
  const trimmed = query.trim()
  const hasExactMatch = items.some((item) => item.label.toLowerCase() === trimmed.toLowerCase())
  const canCreate = onCreate !== undefined && trimmed !== '' && !hasExactMatch

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <input
          ref={inputRef}
          id={id}
          aria-describedby={describedBy}
          disabled={disabled}
          autoComplete="off"
          className={cn(
            'h-[var(--height-field)] w-full rounded-control border border-line-control',
            'bg-surface-card px-12 text-style-body-md text-ink-primary',
            'placeholder:text-ink-tertiary disabled:pointer-events-none disabled:opacity-40',
            'aria-[invalid=true]:border-line-negative',
          )}
          placeholder={placeholder}
          value={query}
          onFocus={openList}
          // Um campo que JÁ tem foco não recebe `focus` de novo: sem isto,
          // clicar nele depois de fechar a lista (Esc, seleção) não reabria.
          onClick={openList}
          onChange={(event) => {
            onQueryChange(event.target.value)
            openList()
          }}
        />
      </Popover.Anchor>
      <Popover.Portal container={portalContainer ?? undefined}>
        <Popover.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(event) => event.preventDefault()}
          // O input é `Anchor`, não `Trigger`, então para o Radix clicar nele é
          // interagir FORA do conteúdo — e a lista fechava no mesmo clique que
          // a abriu (medido em 2026-09-23: foco no campo, lista nenhuma).
          onInteractOutside={(event) => {
            if (event.target instanceof Node && inputRef.current?.contains(event.target)) {
              event.preventDefault()
            }
          }}
          /* Wireframe 47:2 §② (`83:4`): o popover tem a largura do campo que o
             ancora — 340, os mesmos 340 de `122:4` fechado. Antes daqui vinha
             `--width-empty-message`, token da mensagem do estado Vazio
             (`309:49`, hoje 340), emprestado a um campo que nada tem a ver com
             ele — o valor batia por acidente, não por medida. */
          className={cn(
            'z-50 w-[var(--radix-popover-trigger-width)]',
            'rounded-card border border-line-default bg-surface-card p-4',
          )}
        >
          {/* Wireframe 47:2: a ordem dentro do dropdown é cabeçalho (`47:20`,
              24 de altura) → lista ou linha vazia (`47:22`, 31) → divisor
              (`47:24`) → linha de criação (`47:25`). */}
          {listHeading !== undefined ? (
            <p
              className={cn(
                'flex h-[var(--height-dropdown-heading)] items-center px-12',
                'text-style-label-xs text-ink-secondary',
              )}
            >
              {listHeading}
            </p>
          ) : null}
          {listHint !== undefined ? (
            <p className="px-12 pb-8 text-style-body-sm text-ink-secondary">{listHint}</p>
          ) : null}
          {/* `47:22` aparece JUNTO com a linha de criação no frame ③ — antes
              daqui a mensagem sumia assim que "+ Criar" podia aparecer
              (`items.length === 0 && !canCreate`), e o dropdown ficava só com
              o botão de criar, estado que nenhum frame desenha. */}
          {items.length === 0 ? (
            <p
              className={cn(
                'flex h-[var(--height-dropdown-empty)] items-center px-12',
                'text-style-body-sm text-ink-secondary',
              )}
            >
              {emptyLabel}
            </p>
          ) : null}
          {/* Wireframe 47:2 §②: a rolagem é da LISTA (`83:10`), não do popover.
              O rodapé "+ Criar categoria neste bloco" (`83:62`) está ancorado
              em y=239, logo depois dos 174 da lista, e por isso não rola nem
              some quando a lista é longa. Com o `overflow-y-auto` no
              `Popover.Content` inteiro, como estava, ele rolava junto. */}
          <div className="max-h-[var(--height-dropdown-max)] overflow-y-auto">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'flex h-[var(--height-dropdown-row)] w-full items-center rounded-control px-12 text-left',
                  'text-style-body-md text-ink-primary hover:bg-surface-hover',
                )}
                onClick={() => {
                  onSelect(item)
                  setOpen(false)
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          {canCreate ? (
            <button
              type="button"
              className={cn(
                'flex w-full flex-col justify-center rounded-control border-t border-line-default',
                'px-12 text-left',
                createHint === undefined
                  ? 'h-[var(--height-dropdown-create)]'
                  : 'h-[var(--height-dropdown-create-hint)]',
                'hover:bg-surface-hover',
              )}
              onClick={() => {
                onCreate?.(trimmed)
                if (closeOnCreate) setOpen(false)
              }}
            >
              <span className="text-style-body-md font-medium text-ink-state">
                {createLabel ? createLabel(trimmed) : `+ Criar "${trimmed}"`}
              </span>
              {createHint !== undefined ? (
                <span className="text-style-label-xs normal-case text-ink-tertiary">
                  {createHint}
                </span>
              ) : null}
            </button>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
