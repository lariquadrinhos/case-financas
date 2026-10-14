'use client'

import * as React from 'react'
import { searchCategories, suggestClassification } from '@/domain/chart-of-accounts'
import type { Category as DomainCategory } from '@/domain/chart-of-accounts'
import { asId, type BlockId, type CategoryId, type Classification } from '@/domain/core'
import { SearchCreateField, type SearchCreateItem } from './search-create-field'

export interface CategoryFieldCategory {
  readonly id: string
  readonly name: string
  readonly blockId: string
  readonly isSystem: boolean
  readonly archived: boolean
  readonly suggestedClassification: Classification | null
}

export interface CategoryFieldBlock {
  readonly id: string
  readonly name: string
}

/**
 * `84:2` mede 278px de largura numa ÚNICA linha de 12px de altura, e o texto
 * que o frame escreve nela — "Categorias parecidas neste bloco: Alimentação,
 * Automóvel" — tem 55 caracteres. Os 34 do prefixo deixam ~21 para os nomes, e
 * "Alimentação, Automóvel" tem 22: cabem dois nomes, não mais. O corte é a
 * medida do frame, não um número escolhido.
 */
const SIMILAR_LIMIT = 2

/**
 * Categoria — "busca/autocomplete; cria categoria nova inline sem sair do
 * formulário" (files_design/01 §5.1), desenhado no Wireframe `47:2`
 * "Estado — Buscar/Criar Categoria (expandido)". O painel ① (`47:4`) é
 * literalmente este campo: rótulo "Categoria *" (`122:3`) e placeholder
 * "Buscar ou criar categoria…" (`122:5`), os mesmos `6:66`/`6:68` de `262:873`
 * "Desktop — Novo Lançamento (aba Despesa)".
 *
 * O frame decide o fluxo de criação e ele NÃO tem passo intermediário: a ação
 * é uma linha dentro do próprio dropdown (`83:62` sem termo, `47:25` com
 * termo) e a nota `47:27` diz o porquê — "confirma direto: bloco já é o de
 * onde a pessoa clicou (Custo dos Serviços/Produtos), sem precisar escolher de
 * novo". Por isso este componente recebe `block` pronto do chamador em vez de
 * perguntar: nenhum dos 130 frames do Wireframe desenha um seletor de bloco, e
 * o Style guide (`544:764`) não tem componente Select.
 *
 * Aqui havia um painel inventado — "Em qual bloco do Plano de Contas '…'
 * fica?" com um `<Select aria-label="Bloco">` e um par Criar/Cancelar —, texto
 * e controle que não existem em frame nenhum (grep nos 130 XML por
 * "qual bloco|selecionar bloco|escolher bloco|neste bloco" só devolve os três
 * textos de `47:2`).
 *
 * A busca continua sobre TODAS as categorias, não só as do bloco: escopar ao
 * bloco é regra do Plano de Contas, onde a pessoa abriu um bloco (`44:88`) —
 * aqui esconderia "Alimentação" de quem está lançando uma despesa. É só a
 * criação que herda o bloco em contexto, e é isso que "+ Criar categoria
 * neste bloco" (`83:63`) diz.
 *
 * A sugestão passada a `onSelectCategory` é `suggestClassification`,
 * literalmente a função cujo docstring nomeia este campo.
 */
export function CategoryField({
  id,
  'aria-describedby': describedBy,
  categories,
  block,
  blocksToChoose,
  value,
  onSelectCategory,
  onCreateCategory,
  creating,
}: {
  id?: string
  'aria-describedby'?: string
  categories: readonly CategoryFieldCategory[]
  /**
   * O bloco em contexto, de onde a categoria nova nasce (`47:27`). Quem chama
   * é que sabe qual é — no Plano de Contas é o bloco aberto; no Novo
   * Lançamento, ver a suposição nomeada em
   * `src/app/(app)/novo-lancamento/tabs/expense-revenue-fields.tsx`.
   */
  block: CategoryFieldBlock
  /**
   * P34 (produto, 2026-09-08): quando o bloco NÃO está em contexto, criar uma
   * categoria passa a PERGUNTAR em qual bloco ela fica, e estes são os blocos
   * oferecidos. Usado só pelo Novo Lançamento — no Plano de Contas a pessoa
   * abriu um bloco e a nota `47:27` do Wireframe manda confirmar direto.
   *
   * Quem chama filtra: D&A não aceita categoria (`acceptsUserCategories`), e
   * oferecê-lo seria oferecer um caminho que o domínio recusa.
   *
   * Desenhado no Mockup "Desktop — Novo Lançamento (criar categoria: escolher
   * bloco)", claro e escuro: o segundo passo reusa a MESMA anatomia de lista do
   * dropdown, sem componente novo. Uma rodada anterior tinha inventado aqui um
   * `<Select aria-label="Bloco">` que frame nenhum desenhava; a diferença é que
   * agora o frame existe.
   */
  blocksToChoose?: readonly CategoryFieldBlock[]
  /** The currently chosen category's name, or `''` when none is chosen yet. */
  value: string
  onSelectCategory: (category: CategoryFieldCategory, suggestion: Classification | null) => void
  /**
   * Returns the created category so this field can select it immediately —
   * `null` on failure (the parent already surfaced the error; the term the
   * person typed stays in the field so they can try again).
   */
  onCreateCategory: (name: string, blockId: string) => Promise<CategoryFieldCategory | null>
  /** True while the create request is in flight — the field stops taking input. */
  creating?: boolean
}) {
  const [query, setQuery] = React.useState(value)
  /** P34: o nome digitado, enquanto a pessoa escolhe o bloco. `null` fora desse passo. */
  const [nomeAguardandoBloco, setNomeAguardandoBloco] = React.useState<string | null>(null)

  // Keep the field text in sync when the parent resets/prefills the form
  // (edit mode, "Lançar outro") without fighting the person's own typing.
  React.useEffect(() => {
    setQuery(value)
  }, [value])

  // `searchCategories` (src/domain/chart-of-accounts/rules.ts) takes the real
  // domain `Category`, branded ids and all. The wire shape from `/categories`
  // is the same fields with plain `string` ids (no brand survives JSON), so the
  // boundary cast here is the same `asId<T>()` every API route already uses
  // when it reads an id off a request — never a bypass of the type, just the
  // edge where an opaque id enters typed code.
  const asDomainCategory = React.useCallback(
    (category: CategoryFieldCategory): DomainCategory => ({
      id: asId<CategoryId>(category.id),
      blockId: asId<BlockId>(category.blockId),
      name: category.name,
      isSystem: category.isSystem,
      suggestedClassification: category.suggestedClassification,
      archived: category.archived,
      // Inerte aqui: `searchCategories` só lê `name` e `archived`, nunca este
      // campo. Fica `false` para satisfazer o tipo do domínio sem alargar a
      // forma de wire que este componente recebe (P22).
      isPassiveIncome: false,
    }),
    [],
  )

  const domainCategories = React.useMemo(
    () => categories.map(asDomainCategory),
    [categories, asDomainCategory],
  )
  const matches = React.useMemo(
    () => searchCategories(domainCategories, query),
    [domainCategories, query],
  )
  const items: SearchCreateItem[] = matches.map((category) => ({
    id: category.id,
    label: category.name,
  }))

  // `84:2` — "Mitigação de duplicata por sinônimo: ao criar uma categoria nova
  // (sem correspondência encontrada), aparece um lembrete discreto com
  // categorias parecidas já existentes no bloco" (files_design/02 §368; PRD
  // UC40). O que conta como "parecida" nunca foi decidido — a busca de texto
  // simples devolve VAZIO justamente nos casos que a mitigação existe para
  // cobrir (carro/automóvel, pet/nome do bicho), então filtrar pelo termo não
  // mostraria nada. SUPOSIÇÃO NOMEADA (docs/PERGUNTAS-EM-ABERTO.md P34): são
  // as categorias vivas do bloco em contexto, em ordem alfabética — a mesma
  // ordem que `searchCategories('')` já devolve —, cortadas em SIMILAR_LIMIT.
  const similar = React.useMemo(
    () =>
      searchCategories(
        domainCategories.filter((category) => category.blockId === block.id),
        '',
      )
        .slice(0, SIMILAR_LIMIT)
        .map((category) => category.name),
    [domainCategories, block.id],
  )

  function handleSelect(item: SearchCreateItem) {
    // Look the id back up in the ORIGINAL wire list so the callback receives
    // exactly the shape the caller (and the rest of the form) already works
    // with — `matches` only exists to drive the dropdown's search/sort.
    const category = categories.find((c) => c.id === item.id)
    if (!category) return
    setQuery(category.name)
    onSelectCategory(category, suggestClassification(category.name))
  }

  async function handleCreate(name: string, blockId: string = block.id) {
    const created = await onCreateCategory(name, blockId)
    if (created === null) return // parent already surfaced the error; the term stays typed
    setNomeAguardandoBloco(null)
    setQuery(created.name)
    onSelectCategory(created, suggestClassification(created.name))
  }

  // P34 — o segundo passo ocupa O MESMO dropdown, trocando o conteúdo.
  //
  // Não é um componente diferente por um motivo medido: `SearchCreateField`
  // guarda o `open` do Popover internamente, então trocar de instância fecha o
  // dropdown na cara da pessoa. É também o que o Mockup desenha — a lista de
  // blocos aparece onde a de categorias estava, no mesmo painel.
  const escolhendoBloco = nomeAguardandoBloco !== null && blocksToChoose !== undefined

  return (
    <SearchCreateField
      id={id}
      aria-describedby={describedBy}
      disabled={creating}
      items={escolhendoBloco ? blocksToChoose.map((b) => ({ id: b.id, label: b.name })) : items}
      query={escolhendoBloco ? (nomeAguardandoBloco ?? '') : query}
      onQueryChange={escolhendoBloco ? () => undefined : setQuery}
      onSelect={
        escolhendoBloco
          ? (item) => void handleCreate(nomeAguardandoBloco ?? '', item.id)
          : handleSelect
      }
      onCreate={
        escolhendoBloco
          ? undefined
          : (name) =>
              blocksToChoose === undefined ? void handleCreate(name) : setNomeAguardandoBloco(name)
      }
      placeholder="Buscar ou criar categoria…"
      // Sem isso o clique em "+ Criar" fecharia o painel antes de a pessoa ver
      // a lista de blocos (P34).
      closeOnCreate={blocksToChoose === undefined}
      listHeading={escolhendoBloco ? 'ESCOLHA O BLOCO' : 'CATEGORIAS EXISTENTES'}
      listHint={
        escolhendoBloco
          ? `Onde "${nomeAguardandoBloco}" vai ficar no seu Plano de Contas. Não dá pra mudar depois.`
          : undefined
      }
      emptyLabel={escolhendoBloco ? 'Nenhum bloco disponível' : 'Nenhuma categoria encontrada'}
      createLabel={(term) =>
        // "neste bloco" pressupõe bloco conhecido, e é o texto do Wireframe
        // `83:63` — verdadeiro no Plano de Contas. No Novo Lançamento não
        // existe "este bloco", então a frase para antes (P34).
        blocksToChoose === undefined
          ? `+ Criar categoria "${term}" neste bloco`
          : `+ Criar categoria "${term}"`
      }
      createHint={
        // A dica é "parecidas NESTE bloco" (PRD UC40, Figma `84:2`), e sem
        // bloco em contexto ela não tem do que falar. Fica de fora no Novo
        // Lançamento, e a lacuna está registrada na P34.
        blocksToChoose !== undefined || similar.length === 0
          ? undefined
          : `Categorias parecidas neste bloco: ${similar.join(', ')}`
      }
    />
  )
}
