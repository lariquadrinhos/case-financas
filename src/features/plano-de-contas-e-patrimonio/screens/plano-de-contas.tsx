'use client'

/**
 * Plano de Contas pós-onboarding — files_design/01 §10: os 10 blocos fixos do
 * DRE, cada um expansível; sem card de formulário no topo — categoria nova é
 * criada inline dentro do bloco.
 */

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { AccordionRow } from '@/components/patterns/accordion-row'
import { Empty } from '@/components/patterns/empty'
import { EMPTY_STATES } from '@/components/patterns/empty-states'
import { ErrorState } from '@/components/patterns/error-state'
import { ItemRowActions } from '@/components/patterns/item-row-actions'
import { Loading } from '@/components/patterns/loading'
import { BLOCK_IDS } from '@/domain/chart-of-accounts'
import { ApiError } from '@/lib/api-client'
import { BLOCK_CAPTION_BY_ORDER } from '../block-caption'
import { isDuplicateCategoryName } from '../category-rules'
import { categories, useArchiveCategory, useStatementBlocks } from '../chart-of-accounts'
import type { Category, StatementBlock } from '../types'

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Não foi possível salvar. Tente novamente.'
}

export function PlanoDeContasScreen() {
  const blocks = useStatementBlocks()
  const categoryList = categories.useList()
  const [openBlockId, setOpenBlockId] = React.useState<string | null>(null)

  const isLoading = blocks.isLoading || categoryList.isLoading
  const isError = blocks.isError || categoryList.isError
  const allCategories = categoryList.data?.data ?? []
  // Figma 305:1654 draws the empty state for the SCREEN, not per block: it is
  // shown while the person has no category of their own anywhere, whatever the
  // seeded system ones do.
  const hasOwnCategories = allCategories.some(
    (category) => !category.archived && !category.isSystem,
  )

  return (
    <div className="flex flex-col gap-24">
      <div className="flex flex-col gap-16">
        <h1 className="text-style-heading-xl text-ink-primary">Plano de Contas</h1>
        {/* Figma 331:39, word for word. */}
        <p className="max-w-[var(--width-content-max)] text-style-body-sm text-ink-secondary">
          Plano de Contas: os blocos abaixo são fixos e organizam seus relatórios. Cada bloco pode
          ser expandido, clique no nome do bloco pra ver e editar as categorias dentro dele.
        </p>
      </div>
      {isLoading ? (
        <Loading label="Carregando plano de contas" lines={6} />
      ) : isError ? (
        <ErrorState
          message="Não foi possível carregar o plano de contas. Verifique sua conexão e tente de novo."
          onRetry={() => {
            void blocks.refetch()
            void categoryList.refetch()
          }}
        />
      ) : (
        <>
          {hasOwnCategories ? null : <Empty copy={EMPTY_STATES.PLANO_DE_CONTAS} />}
          <div className="flex flex-col gap-8">
            {[...(blocks.data?.data ?? [])]
              .sort((a, b) => a.order - b.order)
              .map((block) => (
                <BlockRow
                  key={block.id}
                  block={block}
                  categories={allCategories.filter(
                    // `!isSystem`: ver o comentário equivalente em
                    // src/app/onboarding/plano-de-contas/_components/plano-de-contas-step.tsx
                    // — "Consumo Livre" saiu da lista do Plano de Contas e virou
                    // área isolada (decisão de produto de 2026-09-07).
                    (category) =>
                      category.blockId === block.id && !category.archived && !category.isSystem,
                  )}
                  open={openBlockId === block.id}
                  onOpenChange={(open) => setOpenBlockId(open ? block.id : null)}
                />
              ))}
          </div>
        </>
      )}
    </div>
  )
}

function BlockRow({
  block,
  categories: blockCategories,
  open,
  onOpenChange,
}: {
  block: StatementBlock
  categories: readonly Category[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <AccordionRow
      /* `name`, não `statementLabel` — src/domain/GLOSSARY.md: «"D&A" na
         cascata vs. o nome completo no Plano de Contas». A regra antiga era
         `statementLabel ?? name`, que acertava o bloco 3 por acidente (lá os
         dois rótulos são iguais) e errava o 6: esta tela imprimia "6. D&A"
         onde os 4 frames de Plano de Contas da página Mockup escrevem
         "6. Depreciação & Amortização (D&A)" — medido no texto literal dos
         frames, e conferido contra "Desktop — DRE (claro)", que é o único
         que encurta. */
      title={`${block.order}. ${block.name}`}
      description={BLOCK_CAPTION_BY_ORDER[block.order]}
      open={open}
      onOpenChange={onOpenChange}
    >
      <div className="flex flex-col gap-4">
        {blockCategories.length === 0 ? (
          <p className="py-8 text-style-body-sm text-ink-secondary">
            Nenhuma categoria neste bloco ainda.
          </p>
        ) : (
          blockCategories.map((category) => <CategoryRow key={category.id} category={category} />)
        )}
        {block.acceptsUserCategories ? (
          <AddCategoryForm blockId={block.id} existing={blockCategories} />
        ) : null}
      </div>
    </AccordionRow>
  )
}

/**
 * Editar/Descartar por categoria — Figma 44:2 (nó 44:88: "Cada categoria tem
 * Editar/Descartar, mesmo padrão do resto do produto"), a mesma linha que o
 * Onboarding 1 mostra, porque files_design/01 §10 diz que esta tela
 * "reaproveita o conteúdo já validado no onboarding".
 *
 * "Descartar" arquiva, não exclui — ver `useArchiveCategory`. O que o PRD
 * §4/§7 proíbe é o DELETE ("não existe ação de EXCLUIR categoria"), que de
 * fato não existe; arquivar preserva o registro porque Lançamentos antigos
 * apontam pro id da categoria, e a some das listas, que é a segunda metade da
 * mesma frase do PRD ("categoria não utilizada apenas deixa de ser usada").
 *
 * "Editar" troca a linha por uma renomeação inline, e o Figma desenha esse
 * estado em dois lugares. O COMPORTAMENTO vem do Wireframe 46:8 "Estado —
 * Editar categoria (inline)", cuja nota (nó 46:33) diz «Campo vira texto
 * editável ali mesmo, sem popup. "Salvar" confirma, "Cancelar" reverte sem
 * alterar.» A GEOMETRIA vem do Mockup `Categoria em edição` (1301:5237),
 * desenhado com o time de design em 2026-09-08 e plugado nas telas
 * "Desktop — Plano de Contas (editar categoria)" (1287:4613 claro / 1287:4665
 * escuro) — que são o desenho DESTA tela. Onde os dois discordam manda o
 * Mockup (ADR-0015; files_design/02 "Editar categoria: o Mockup fecha a
 * geometria"), e eles discordam em dois pontos:
 *
 *   - o campo tem rótulo VISÍVEL "Nome da categoria *" acima (o Wireframe
 *     46:26 continha só o nome com o cursor, sem rótulo, e o código supria
 *     com aria-label). É a instância `Campo`, a mesma da linha de criar
 *     categoria logo abaixo — e como o rótulo passa a ser idêntico ao dela,
 *     o formulário vira um grupo nomeado, senão o bloco expandido fica com
 *     duas caixas de mesmo nome acessível;
 *   - os botões ficam alinhados à DIREITA (`Ações`, HORIZONTAL/MAX), não à
 *     esquerda como o 46:28 desenhava: o Wireframe empilha tudo na margem
 *     esquerda porque não tem camada visual.
 *
 * O que os dois concordam e continua valendo: o campo ocupa a linha inteira
 * sozinho (46:25 mede 320×31 com o campo 46:26 em 296 — a largura toda menos
 * os 12 de recuo de cada lado; não sobra faixa lateral para botão), a ordem é
 * Cancelar e depois Salvar, e os dois têm o MESMO peso — a caixa de 25px de
 * 46:29/46:31 é idêntica à de "Editar" (46:16) e "Descartar" (46:18), e
 * files_design/07 §"Botão" limita primário a "uma só por tela ou por
 * formulário". Daí `secondary` nos dois, igual ao irmão do Onboarding 1
 * (src/app/onboarding/plano-de-contas/_components/category-row.tsx), que
 * files_design/01 §10 manda esta tela reaproveitar.
 *
 * O gap desenhado entre os dois botões é 6px, que não existe na Escala fechada
 * de 4; fica `gap-8` (--space-8), o mesmo token que ItemRowActions já usa no
 * par Editar/Descartar, que o frame desenha com esses mesmos 6px.
 */
function CategoryRow({ category }: { category: Category }) {
  const patch = categories.usePatch()
  const archive = useArchiveCategory()
  const [editing, setEditing] = React.useState(false)
  const [name, setName] = React.useState(category.name)
  const [passive, setPassive] = React.useState(category.isPassiveIncome)
  const [error, setError] = React.useState<string | undefined>(undefined)

  if (editing) {
    return (
      <div
        role="group"
        aria-label={`Editar categoria ${category.name}`}
        className="flex flex-col gap-12 border-b border-line-default py-8 last:border-0"
      >
        {/* 1301:5237 › `Campo` — o campo sozinho na linha, na largura toda,
            com o rótulo visível acima. */}
        <label className="flex flex-col gap-4">
          <span className="text-style-body-sm text-ink-secondary">Nome da categoria *</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        </label>
        {/* Marcador de renda passiva — decisão de produto de 2026-09-08 (P22),
            desenhada depois no Mockup 1301:5237: rótulo à esquerda, Toggle à
            direita. Só em Receita Bruta, porque `passiveIncomeCoverage`
            (src/domain/reports/indicators.ts) só soma linhas desse bloco —
            oferecer o controle numa despesa seria um no-op confuso. */}
        {category.blockId === BLOCK_IDS.grossRevenue ? (
          <div className="flex items-center justify-between gap-16">
            <label
              htmlFor={`passive-income-${category.id}`}
              className="text-style-body-md text-ink-primary"
            >
              Conta como renda passiva
            </label>
            <Switch
              id={`passive-income-${category.id}`}
              checked={passive}
              onCheckedChange={setPassive}
            />
          </div>
        ) : null}
        {/* 1301:5237 › `Ações` — última linha, à direita: Cancelar, Salvar. */}
        <div className="flex items-center justify-end gap-8">
          <Button variant="secondary" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
          <Button
            variant="secondary"
            disabled={name.trim() === '' || patch.isPending}
            onClick={() => {
              patch.mutate(
                { id: category.id, body: { name: name.trim(), isPassiveIncome: passive } },
                {
                  onSuccess: () => {
                    setEditing(false)
                    setError(undefined)
                  },
                  onError: (patchError) => setError(errorMessage(patchError)),
                },
              )
            }}
          >
            Salvar
          </Button>
        </div>
        {/* 46:8 não desenha slot de erro, e a mensagem local "O nome não pode
            ficar vazio." que existia aqui era invenção: o frame não a tem, e o
            desenho já resolve o caso vazio desabilitando "Salvar". O que fica
            é só a recusa do servidor — um PATCH que falha não pode falhar em
            silêncio (CLAUDE.md §4, qualidade é premissa), e a faixa só aparece
            depois do erro, sem alterar o layout desenhado. */}
        {error ? (
          <span role="alert" className="text-style-body-sm text-ink-negative">
            {error}
          </span>
        ) : null}
      </div>
    )
  }

  /* 12 de recuo em cima e embaixo, não a caixa fixa de 44: o par
     Editar/Descartar já é 44 (--height-button), então uma linha de 44 deixava
     o botão encostando na divisória — foi a poluição que o time de design
     apontou. Medido nas três listas de item do Mockup que já existiam (Contas
     Bancárias, Bens Materiais e a "Linha da tabela" da Revisão de
     Recorrentes): todas 68 = 12 + 44 + 12, com a mesma divisória fina em
     color/border/default. A divisória fica (doc07, regra 3: "uma divisória
     fininha só, e só onde separa significado") e NÃO vira caixa com borda dos
     4 lados, porque o bloco expandido já é um contêiner com contorno e a
     regra 7 proíbe card dentro de card. */
  return (
    <div className="flex items-center justify-between gap-16 border-b border-line-default py-12 last:border-0">
      <span className="text-style-body-md text-ink-primary">{category.name}</span>
      {/* Sem ramo de categoria de sistema: "Consumo Livre" não é mais listada
          aqui (ver o filtro acima). O rótulo "Categoria fixa do sistema" que
          ficava neste lugar não existia em frame nenhum — grep nos 130 XML do
          Wireframe e na página Mockup devolvia zero ocorrências. */}
      <ItemRowActions
        onEdit={() => {
          // 46:33: «"Cancelar" reverte sem alterar» — o rascunho volta ao
          // nome atual a cada entrada, senão a segunda edição abriria com o
          // texto abandonado na primeira.
          setName(category.name)
          setPassive(category.isPassiveIncome)
          setError(undefined)
          setEditing(true)
        }}
        onDiscard={() => archive.mutate(category.id)}
      />
    </div>
  )
}

function AddCategoryForm({
  blockId,
  existing,
}: {
  blockId: string
  existing: readonly Category[]
}) {
  const create = categories.useCreate()
  const [name, setName] = React.useState('')
  const [error, setError] = React.useState<string | undefined>(undefined)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (trimmed === '') {
      setError('Informe o nome da categoria.')
      return
    }
    // Same normalisation the server uses for the duplicate check — caught here
    // too so the person sees the message before the round trip, not just after
    // a 409 (Figma 48:2: "Não há opção de criar duplicata").
    if (isDuplicateCategoryName(existing, trimmed)) {
      setError('Essa categoria já existe neste bloco.')
      return
    }
    setError(undefined)
    create.mutate(
      { blockId, name: trimmed, suggestedClassification: null },
      {
        onSuccess: () => setName(''),
        onError: (createError) => setError(errorMessage(createError)),
      },
    )
  }

  /*
   * A linha inteira é o nó 121:2 do Wireframe 44:2, medido no XML
   * (docs/figma/frames/44-2__onboarding-1-bloco-de-categoria-expandido-exemplo.xml):
   * 572 de largura partidos em duas colunas IGUAIS — campo 121:3 em x=0 w=282,
   * vão de 8, coluna do botão 202:16 em x=290 w=282 — e o botão 121:5 dentro
   * dela em x=153 w=129, ou seja terminando em 572, encostado na borda direita
   * da linha. Daí `grid-cols-2 gap-8` (282 + 8 + 282 = 572) e
   * `justify-self-end`: a proporção é medida, não escolhida.
   *
   * O que estava aqui era `w-[var(--width-inline-category-edit)]`, 280px fixos
   * justificados no token por "wide enough for the longest bloco de referência
   * ('Despesas Administrativas')" — dedução, não medição: esse texto é o TÍTULO
   * do bloco 4 (nó 44:28, 179px) e nunca entra neste campo. O número medido é
   * 282, e ele não é fixo: é metade da linha menos o vão, então largura fixa
   * nenhuma acompanharia a linha. O token saiu de src/styles/tokens.css.
   *
   * Os textos são os literais do frame: 121:4 "Nome da categoria *" (com o
   * asterisco de obrigatório que a legenda 216:10 "* Campo obrigatório"
   * explica) e 121:6 "+ Criar categoria" — os mesmos que o irmão do Onboarding
   * 1 já escreve (src/app/onboarding/plano-de-contas/_components/block-accordion-row.tsx),
   * e que files_design/01 §10 manda esta tela reaproveitar. "Nova categoria" e
   * "+ Adicionar categoria" não existem em nó nenhum do arquivo.
   *
   * A altura de cada um vem do Style guide, não da medição: ali TODO controle é
   * o mesmo traço cinza de 35, então o frame decide posição, não altura — Caixa
   * do Campo 40 (460:5), Botão 44 (458:2..458:24), com `items-end` alinhando a
   * base do par.
   */
  return (
    <form className="grid grid-cols-2 items-end gap-8 pt-8" onSubmit={handleSubmit}>
      <Field label="Nome da categoria" error={error}>
        {(fieldProps) => (
          <Input {...fieldProps} value={name} onChange={(event) => setName(event.target.value)} />
        )}
      </Field>
      <Button
        type="submit"
        variant="secondary"
        className="justify-self-end"
        disabled={create.isPending}
      >
        + Criar categoria
      </Button>
    </form>
  )
}
