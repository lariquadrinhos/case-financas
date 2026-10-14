'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronDownIcon, ChevronRightIcon } from '@/components/ui/icons'
import { formatMoney, ZERO } from '@/domain/core'
import { categories } from '@/features/plano-de-contas-e-patrimonio/chart-of-accounts'
import type { Category, StatementBlock } from '@/features/plano-de-contas-e-patrimonio/types'
import { CategoryRow } from './category-row'
import { BLOCK_CAPTION_BY_ORDER } from '@/features/plano-de-contas-e-patrimonio/block-caption'

/**
 * Linha expansível — files_design/07 §328: "Cabeçalho com título numerado
 * (body.md-medium) + descrição auxiliar (body.md, color/text/secondary) +
 * `icon/chevron-right` (recolhido) ou `icon/chevron-down` (expandido).
 * Recolhido é só o cabeçalho em `color/bg/subtle`; expandido ganha contorno
 * `color/border/default`, uma divisória e a área de conteúdo do bloco."
 *
 * O chevron era um glifo de texto (▸/▾) "pra o produto ter uma afordância só,
 * não duas" — o argumento era certo, a conclusão é que a afordância única é o
 * COMPONENTE de ícone: `icon/chevron-down` (master 470:2) e
 * `icon/chevron-right` (470:4), os mesmos que a barra lateral (Mockup 749:12 /
 * 749:28) e a `AccordionRow` pós-onboarding usam.
 *
 * D&A (`acceptsUserCategories: false`) is the one block with no create form
 * and no per-category actions — Figma 51:32, "Sem botão de criar categoria e
 * sem Editar/Descartar: não há nada aqui pra editar."
 */
export function BlockAccordionRow({
  block,
  categoryList,
  expanded,
  onToggle,
}: {
  block: StatementBlock
  categoryList: readonly Category[]
  expanded: boolean
  onToggle: () => void
}) {
  const headerId = `bloco-${block.id}-cabecalho`
  const panelId = `bloco-${block.id}-conteudo`

  return (
    <div
      className={
        expanded
          ? 'rounded-control border border-line-default'
          : 'rounded-control border border-transparent bg-surface-subtle'
      }
    >
      <h3>
        <button
          type="button"
          id={headerId}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-start justify-between gap-16 px-16 py-12 text-left hover:bg-surface-hover"
        >
          <span className="flex flex-col gap-4">
            <span className="text-style-body-md font-medium text-ink-primary">
              {block.order}. {block.name}
            </span>
            <span className="text-style-body-sm text-ink-secondary">
              {BLOCK_CAPTION_BY_ORDER[block.order]}
            </span>
          </span>
          {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </button>
      </h3>

      {expanded ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headerId}
          className="border-t border-line-default px-16 pb-16 pt-8"
        >
          {block.acceptsUserCategories ? (
            <ExpandedCategories blockId={block.id} categoryList={categoryList} />
          ) : (
            <ReadOnlyBlockContent />
          )}
        </div>
      ) : null}
    </div>
  )
}

function ExpandedCategories({
  blockId,
  categoryList,
}: {
  blockId: string
  categoryList: readonly Category[]
}) {
  const [newName, setNewName] = React.useState('')
  const create = categories.useCreate()

  function submit() {
    const trimmed = newName.trim()
    if (trimmed === '') return
    create.mutate(
      { blockId, name: trimmed, suggestedClassification: null },
      { onSuccess: () => setNewName('') },
    )
  }

  return (
    <>
      <div className="flex flex-col">
        {categoryList.map((category) => (
          <CategoryRow key={category.id} category={category} />
        ))}
      </div>
      {/* Wireframe 44:2 — este é o frame desta própria tela — nó 121:2, medido
          no XML: a linha mede 572 partidos em duas colunas IGUAIS de 282 com 8
          de vão (campo 121:3 em x=0 w=282; coluna do botão 202:16 em x=290
          w=282), e o botão 121:5 dentro dela (x=153, w=129) termina em 572,
          encostado na borda direita da linha. Daí `grid-cols-2 gap-8`
          (282 + 8 + 282 = 572) e `justify-self-end`.

          O que estava aqui era `flex` com o campo em `flex-1`: o campo comia
          todo o espaço que o botão não usasse — não 282 de 572 — e a tela
          pós-onboarding, que files_design/01 §10 manda reaproveitar este mesmo
          conteúdo, media diferente.

          A altura não vem do frame: ali TODO controle é o mesmo traço cinza de
          35, então o desenho decide posição, não altura. Quem decide é o Style
          guide — Caixa do Campo 40 (460:5), Botão 44 (458:2..458:24) — e o
          `items-end` alinha a base do par. */}
      <div className="mt-12 grid grid-cols-2 items-end gap-8">
        <label className="flex flex-col gap-4">
          <span className="text-style-body-sm text-ink-secondary">Nome da categoria *</span>
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
            }}
          />
        </label>
        <Button
          variant="primary"
          className="justify-self-end"
          onClick={submit}
          disabled={newName.trim() === '' || create.isPending}
        >
          + Criar categoria
        </Button>
      </div>
    </>
  )
}

/** Bloco 6 (D&A) — Figma 51:32, the one block that is read-only. */
function ReadOnlyBlockContent() {
  return (
    <div className="flex flex-col gap-12">
      <div className="flex items-center justify-between gap-16 py-8">
        <span className="text-style-body-md text-ink-primary">Valor deste bloco</span>
        <span className="text-style-numeric-md text-ink-tertiary">{formatMoney(ZERO)} (fixo)</span>
      </div>
      <p className="text-style-body-sm text-ink-secondary">
        Este bloco não tem categorias: é sempre zero no MVP (sem depreciação mensal). Ganho ou perda
        de ativos só é reconhecido na venda, em Resultado Não Operacional.
      </p>
    </div>
  )
}
