/**
 * Plano de Contas — the rules the person exercises over the chart.
 *
 * Every function here is a pure transition: it takes the whole chart and gives
 * back a new one, so the caller can diff, undo or persist it without the domain
 * knowing where the data lives. Nothing is mutated in place.
 *
 * Two decisions from the design sources shape this whole file:
 *
 * 1. **There is no delete.** "Categoria não utilizada simplesmente não é usada"
 *    (files_design/01 §3.1); the "Descartar" button on a category line
 *    (Figma 44:2) archives it — the record stays in the chart because past
 *    Lançamentos still point at its id, it just stops being offered.
 * 2. **Blocks are fixed, categories are not** (files_design/01 §3.1). No rule
 *    here creates, renames or reorders a block — e isso é definitivo, não
 *    provisório: o PRD v7 §1 e §9.5 fecharam o H10 ("os 10 blocos são fixos"),
 *    revertendo a premissa da v6 de que a cascata viraria configurável.
 *    `DEFAULT_BLOCKS` é o único lugar onde a estrutura está escrita.
 */

import type { BlockId, CategoryId, Classification } from '@/domain/core'

import {
  DEFAULT_BLOCKS,
  DEFAULT_CATEGORIES,
  type Category,
  type ChartOfAccounts,
  type StatementBlock,
  isUncategorized,
  type CascadeEffect,
} from './types'

/* -------------------------------------------------------------------------
 * Text normalisation — the shared spine of "Buscar e Criar"
 * ---------------------------------------------------------------------- */

/**
 * Folds a name to the form used for searching and for duplicate detection:
 * accents stripped, lower case, inner whitespace collapsed.
 *
 * The product needs this because the person types without accents. Figma 48:2
 * is explicit: typing "vestuario" must find the existing "Vestuário" and offer
 * Editar/Descartar instead of "+ Criar categoria" — "Não há opção de criar
 * duplicata". Search and the duplicate check therefore share one normaliser;
 * if they diverged, a name the search says already exists could still be
 * created.
 *
 * Kept exported: the same "Buscar e Criar" pattern serves investimento and
 * passivo pickers (Figma 166:2), and they must fold names identically.
 */
export function normalizeForSearch(value: string): string {
  return (
    value
      .normalize('NFD')
      // Unicode combining marks: the accents NFD just split off their letters.
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/**
 * Reading order for the picker: alphabetical, ignoring accents, so "Ração"
 * files under R and not after Z (Figma 83:64 — "Lista completa, em ordem
 * alfabética"; files_design/02 §"Busca de categoria").
 *
 * Deliberately not `localeCompare`: a pure function must give the same answer
 * on every machine, and collation depends on the runtime's ICU data. Comparing
 * the folded name and breaking ties on the raw one is stable everywhere.
 */
function byNameForReading(a: Category, b: Category): number {
  const left = normalizeForSearch(a.name)
  const right = normalizeForSearch(b.name)
  if (left !== right) return left < right ? -1 : 1
  if (a.name !== b.name) return a.name < b.name ? -1 : 1
  return 0
}

/* -------------------------------------------------------------------------
 * Reading the chart
 * ---------------------------------------------------------------------- */

/**
 * Event Storming Fluxo A: "Inicializar plano de contas (a partir do modelo)" →
 * *Plano de contas inicializado*. The 10 fixed blocks plus the PRD's reference
 * categories ("Plano de contas de referência"), which are a starting point the
 * person edits, not a closed list (PRD §1).
 *
 * The arrays are copied so a caller that casts `readonly` away cannot reach
 * back into the module constants and change everybody else's chart.
 */
export function initializeChartOfAccounts(): ChartOfAccounts {
  return { blocks: [...DEFAULT_BLOCKS], categories: [...DEFAULT_CATEGORIES] }
}

/**
 * The categories inside a block, archived ones included, in the order the chart
 * holds them.
 *
 * Not alphabetical on purpose: the Plano de Contas screen prints the block's
 * categories in the reference order of the PRD — Figma 44:2 expands Despesas
 * Pessoais/Consumo as "Alimentação · Transporte · Lazer/Entretenimento ·
 * Vestuário · Outras despesas pessoais · Consumo livre". Alphabetical order
 * belongs to the picker, and that is `searchCategories`.
 */
export function categoriesOfBlock(chart: ChartOfAccounts, blockId: BlockId): readonly Category[] {
  return chart.categories.filter((category) => category.blockId === blockId)
}

/**
 * The block a category lives in — the "Bloco: 5. Despesas Pessoais/Consumo"
 * line the search results print (Figma 48:5), and what the DRE needs to know
 * which cascade line an entry falls on.
 *
 * `null` for an unknown id, following `percentOf` in core: an absent answer is
 * a value, not an exception.
 */
export function blockOfCategory(
  chart: ChartOfAccounts,
  categoryId: CategoryId,
): StatementBlock | null {
  const category = findCategory(chart, categoryId)
  if (category === null) return null
  return chart.blocks.find((block) => block.id === category.blockId) ?? null
}

/**
 * The "Buscar e Criar" pattern (Figma 166:2), the single interaction reused by
 * every category field in the product — Plano de Contas and Novo Lançamento.
 *
 * - No term: the full list, so the person can browse without knowing the exact
 *   name (files_design/02: "mostra a lista completa (ordem alfabética) assim
 *   que o campo é clicado, antes de qualquer digitação, não começa vazia").
 * - With a term: filtered by substring, accent- and case-insensitively.
 * - Archived categories are never offered: "Descartar" is the product's word
 *   for taking an item out of a list (files_design/02 §"Descartar mantido como
 *   termo único"), and an archived category is one the person already put away.
 *   It stays in `chart.categories` for the entries that point at it.
 *
 * The caller scopes the input: on Plano de Contas the search is scoped to the
 * block the person clicked (Figma 44:88 — "A busca/criação de categoria fica
 * escopada dentro do bloco"), which is why this takes a category list and not
 * the whole chart.
 */
export function searchCategories(
  categories: readonly Category[],
  term: string,
): readonly Category[] {
  const needle = normalizeForSearch(term)
  // "A categorizar" (PRD v7.46) é só o destino provisório do que vem do banco:
  // quem escolhe uma categoria está justamente saindo dela. Oferecê-la listava
  // "A categorizar" DUAS vezes no Novo Lançamento (a de despesa e a de
  // receita), medido em 2026-09-29.
  const offered = categories.filter(
    (category) => !category.archived && !isUncategorized(category.id),
  )
  const matching =
    needle === ''
      ? offered
      : offered.filter((category) => normalizeForSearch(category.name).includes(needle))
  return [...matching].sort(byNameForReading)
}

/* -------------------------------------------------------------------------
 * Changing the chart
 * ---------------------------------------------------------------------- */

/**
 * What the person fills in to create a category. The id comes from outside: the
 * domain never generates one, because it may not call `Math.random()` and a
 * rule that cannot be replayed with the same inputs is not testable
 * (src/domain/README.md §"Convenções").
 */
export interface NewCategory {
  readonly id: CategoryId
  readonly blockId: BlockId
  /** pt-BR free text — "Nome da categoria *" (Figma 121:4), required. */
  readonly name: string
  /**
   * Left to the caller instead of inferred here: the screen may prefill it with
   * `suggestClassification(name)`, but a category with no obvious keyword must
   * be allowed to carry no suggestion at all.
   */
  readonly suggestedClassification?: Classification | null
  /** Optional: a category only counts as renda passiva if the person says so (P22). */
  readonly isPassiveIncome?: boolean
}

/**
 * PRD §1 UC16 — "A pessoa edita o plano de contas, criando uma categoria de
 * despesa própria dentro de um dos blocos".
 *
 * Rejects, in this order: a block that does not exist, D&A (the one read-only
 * block — Figma 331:106 "Sempre zero no MVP: somente leitura"), a blank name
 * (files_design/01 §5.6: fields are required by default), an id already in use,
 * and a name already taken inside the same block (Figma 48:21 — "Não há opção
 * de criar duplicata").
 */
export function createCategory(chart: ChartOfAccounts, draft: NewCategory): ChartOfAccounts {
  const block = chart.blocks.find((candidate) => candidate.id === draft.blockId) ?? null
  if (block === null) {
    throw new Error('chart_of_accounts.unknown_block')
  }
  if (!block.acceptsUserCategories) {
    throw new Error('chart_of_accounts.block_refuses_categories')
  }

  const name = draft.name.trim()
  if (name === '') {
    throw new Error('chart_of_accounts.blank_name')
  }
  if (chart.categories.some((category) => category.id === draft.id)) {
    throw new Error('chart_of_accounts.duplicate_id')
  }
  if (activeNamesake(chart.categories, draft.blockId, name) !== null) {
    throw new Error('chart_of_accounts.duplicate_name')
  }

  const created: Category = {
    id: draft.id,
    blockId: draft.blockId,
    name,
    // Only the product ships system categories; nothing in the sources lets the
    // person create one.
    isSystem: false,
    suggestedClassification: draft.suggestedClassification ?? null,
    archived: false,
    // A categoria nasce comum; marcar como renda passiva é uma ação separada,
    // na própria linha do Plano de Contas (P22, decisão de 2026-09-08).
    isPassiveIncome: draft.isPassiveIncome ?? false,
  }
  return { ...chart, categories: [...chart.categories, created] }
}

/**
 * "Editar" on a category line: the name becomes an editable field in place and
 * "Salvar" confirms (Figma 46:33). Only the name changes — the id is what the
 * Lançamentos already recorded, and the block is where the person clicked.
 */
export function renameCategory(
  chart: ChartOfAccounts,
  categoryId: CategoryId,
  newName: string,
): ChartOfAccounts {
  const current = requireCategory(chart, categoryId)
  refuseIfSystem(current)

  const name = newName.trim()
  if (name === '') {
    throw new Error('chart_of_accounts.blank_name')
  }

  const namesake = activeNamesake(chart.categories, current.blockId, name)
  // A namesake that IS this category is the person fixing the spelling of a
  // name only they own — "vestuario" → "Vestuário" must go through.
  if (namesake !== null && namesake.id !== current.id) {
    throw new Error('chart_of_accounts.duplicate_name')
  }

  return replaceCategory(chart, { ...current, name })
}

/**
 * Corrects the suggestion a category hands the Novo Lançamento form, without
 * touching name or archival state.
 *
 * No screen exposes this as its own field today — Figma 44:2/46:33 only ever
 * show "Editar" acting on the name — but `PATCH /api/v1/categories/{id}`
 * accepts `suggestedClassification` (src/api/contracts/chart-of-accounts.ts,
 * exception 3 of files_design/03), so the rule has to exist on the same
 * footing as `renameCategory`: same guard, because a system category's
 * suggestion is exactly as fixed as its name (Consumo Livre always posts to
 * Despesas Pessoais and has no reason to steer Classificação at all).
 */
export function updateSuggestedClassification(
  chart: ChartOfAccounts,
  categoryId: CategoryId,
  suggestedClassification: Classification | null,
): ChartOfAccounts {
  const current = requireCategory(chart, categoryId)
  refuseIfSystem(current)
  return replaceCategory(chart, { ...current, suggestedClassification })
}

/**
 * "Conta como renda passiva" on a category line — the flag
 * `passiveIncomeCoverage` reads (P22, decisão de produto de 2026-09-08).
 *
 * Refuses a system category for the same reason renaming does: "Consumo Livre"
 * is a despesa the widget always posts to, and marking it as revenue would put
 * it in a ratio it has no business being in.
 */
export function markPassiveIncome(
  chart: ChartOfAccounts,
  categoryId: CategoryId,
  isPassiveIncome: boolean,
): ChartOfAccounts {
  const current = requireCategory(chart, categoryId)
  refuseIfSystem(current)
  return replaceCategory(chart, { ...current, isPassiveIncome })
}

/**
 * "Descartar" on a category line (Figma 44:43). The category leaves the picker
 * but never leaves the chart: files_design/01 §3.1 is explicit that there is no
 * delete, and the DRE still has to name the category of every entry already
 * posted to it.
 *
 * Archiving twice is not an error — the second call has nothing left to do and
 * gives the chart back unchanged. The screen cannot even produce it: an
 * archived category is no longer listed.
 *
 * Recriar um nome arquivado cria um registro NOVO — decisão de produto,
 * 2026-09-08 (P11). Restaurar a antiga foi recusado pelo efeito colateral:
 * desarquivar traria de volta, sem aviso, os lançamentos antigos para as
 * listas, e não há tela que pergunte se é isso que a pessoa quer. `createCategory`
 * já permitia, porque `activeNamesake` só olha categorias ATIVAS do mesmo bloco
 * — o que era descuido virou decisão.
 */
export function archiveCategory(chart: ChartOfAccounts, categoryId: CategoryId): ChartOfAccounts {
  const current = requireCategory(chart, categoryId)
  refuseIfSystem(current)
  if (current.archived) return chart
  return replaceCategory(chart, { ...current, archived: true })
}

/* -------------------------------------------------------------------------
 * Suggested Classificação
 * ---------------------------------------------------------------------- */

interface ClassificationKeyword {
  /** Already folded by `normalizeForSearch` — compared against a folded name. */
  readonly keyword: string
  readonly classification: Classification
  /** Where the reading comes from, so the list can be argued with, not guessed at. */
  readonly source: string
}

/**
 * The keywords behind the suggested Classificação, in evaluation order: the
 * first one found in the name wins, so the explicit horizons ("curto prazo",
 * "longo prazo") are tested before the nouns they may qualify — "Financiamento
 * de curto prazo" is circulante, not the other way round.
 *
 * Every row is read off the Balanço Patrimonial of the PRD §"Balanço
 * Patrimonial", which is the only place the sources say which things are
 * circulante and which are not. The meaning the person sees in the tooltip is
 * the 12-month horizon (files_design/02 §"Ícone i de ajuda contextual":
 * "Circulante: previsto para até 12 meses" / "Não circulante: prazo maior que
 * 12 meses"), and these words are the ones the PRD itself filed on each side.
 *
 * P7, decidido em 2026-09-09: a lista tem DOIS blocos, e a diferença entre eles
 * está escrita em cada linha, no campo `source`.
 *
 * As sete primeiras são o vocabulário do próprio PRD — a derivação completa das
 * quatro linhas do Balanço, a única fonte que diz o que é circulante e o que não
 * é. Elas vêm antes por isso: onde a fonte fala, é ela que decide.
 *
 * As de baixo são COLOQUIAIS: palavras que a pessoa digita e que nenhuma fonte
 * escreve. Entraram porque uma sugestão que não reconhece "consórcio" nem
 * "cheque especial" não sugere quase nada na prática, e o custo de errar é o
 * menor possível — o campo continua editável nas duas telas, e (medido em
 * 2026-09-09) a Classificação de um Lançamento não alimenta relatório nenhum:
 * o Balanço é montado sobre contas, investimentos, bens e passivos, não sobre
 * lançamentos. Ela serve de filtro no Histórico.
 */
export const CLASSIFICATION_KEYWORDS: readonly ClassificationKeyword[] = [
  {
    keyword: 'curto prazo',
    classification: 'Current',
    source: 'PRD §Balanço — "aplicações de curto prazo", "parcelas de curto prazo"',
  },
  {
    keyword: 'longo prazo',
    classification: 'NonCurrent',
    source: 'PRD §Balanço — "investimentos de longo prazo", "empréstimos de longo prazo"',
  },
  {
    keyword: 'cartao',
    classification: 'Current',
    source: 'PRD §Balanço — "Passivo circulante — cartão de crédito"',
  },
  {
    keyword: 'financiamento',
    classification: 'NonCurrent',
    source: 'PRD §Balanço — "Passivo não circulante — saldo devedor de financiamento"',
  },
  {
    keyword: 'emprestimo',
    classification: 'NonCurrent',
    source: 'PRD §Balanço — "empréstimos de longo prazo"',
  },
  {
    keyword: 'imovel',
    classification: 'NonCurrent',
    source: 'PRD §Balanço — "Ativo não circulante — imóvel próprio"',
  },
  {
    keyword: 'veiculo',
    classification: 'NonCurrent',
    source: 'PRD §Balanço — "Ativo não circulante — veículo"',
  },

  /* --- Coloquiais (P7, 2026-09-09): sem fonte escrita, e por isso depois --- */
  {
    keyword: 'consorcio',
    classification: 'NonCurrent',
    source: 'P7 — coloquial: consórcio se paga em anos',
  },
  {
    keyword: 'tesouro',
    classification: 'NonCurrent',
    source:
      'P7 — coloquial: Tesouro Direto, o "investimento de longo prazo" do PRD pelo nome de mercado',
  },
  {
    keyword: 'cheque especial',
    classification: 'Current',
    source: 'P7 — coloquial: dívida rotativa, vence no mês',
  },
  {
    keyword: 'crediario',
    classification: 'Current',
    source: 'P7 — coloquial: parcelas de curto prazo pelo nome de loja',
  },
  {
    keyword: 'parcelamento',
    classification: 'Current',
    source: 'P7 — coloquial: o "parcelas de curto prazo" do PRD como a pessoa escreve',
  },
  {
    keyword: 'poupanca',
    classification: 'Current',
    source: 'P7 — coloquial: resgate imediato, é a "aplicação de curto prazo" do PRD',
  },
  {
    keyword: 'cdb',
    classification: 'Current',
    source: 'P7 — coloquial: CDB de liquidez diária é o caso comum; prazo maior a pessoa corrige',
  },
  {
    keyword: 'fgts',
    classification: 'NonCurrent',
    source: 'P7 — coloquial: saque condicionado, não é dinheiro de 12 meses',
  },
]

/**
 * Suggests Circulante / Não circulante from the words in a name — the Passivo
 * form ("sugerida automaticamente por palavra-chave, editável",
 * files_design/01 §3.5) and the Classificação field of Novo Lançamento
 * ("sugerida a partir da categoria; editável", files_design/03 §"Aba Despesa").
 *
 * It is a suggestion and never an imposition. The field stays editable in both
 * screens and the reason is written down in the UX log (files_design/02: the
 * suggestion "reduz fricção de preenchimento sem tirar controle da pessoa").
 * Only the person knows whether *their* "Empréstimo do tio" is due next month
 * or in five years, and the Balanço is only as honest as that answer — so the
 * rule pre-selects and steps back.
 *
 * `null` means "no keyword recognised": the screen keeps its own default rather
 * than being handed a coin flip.
 */
export function suggestClassification(name: string): Classification | null {
  const haystack = normalizeForSearch(name)
  if (haystack === '') return null
  const hit = CLASSIFICATION_KEYWORDS.find((entry) => haystack.includes(entry.keyword))
  return hit?.classification ?? null
}

/* -------------------------------------------------------------------------
 * Internals
 * ---------------------------------------------------------------------- */

function findCategory(chart: ChartOfAccounts, categoryId: CategoryId): Category | null {
  return chart.categories.find((category) => category.id === categoryId) ?? null
}

function requireCategory(chart: ChartOfAccounts, categoryId: CategoryId): Category {
  const category = findCategory(chart, categoryId)
  if (category === null) {
    throw new Error('chart_of_accounts.unknown_category')
  }
  return category
}

/**
 * A system category is fixed where the product put it — GLOSSARY.md, `isSystem`:
 * «"Consumo Livre", fixa dentro de Despesas Pessoais». The Consumo Livre widget
 * posts every gasto to that exact category (files_design/03 §"Consumo Livre —
 * widget": "Gera um Lançamento com Categoria fixa 'Consumo Livre'"), so letting
 * it be renamed or discarded would break a flow that has no other target.
 *
 * O `44:78` desenha "Consumo livre" com o mesmo par Editar/Descartar dos
 * vizinhos, e isso deixou de ser contradição em 2026-09-07 (P10): produto
 * decidiu que a categoria SAI da lista do Plano de Contas e vira área de
 * consumo isolada, com widget próprio na Home (files_design/01 §4a). Fora da
 * lista, a regra do `44:88` ("cada categoria tem Editar/Descartar") vale sem
 * exceção para tudo que está listado, e esta trava continua protegendo o
 * widget, que sempre lança nesta categoria.
 */
function refuseIfSystem(category: Category): void {
  if (category.isSystem) {
    throw new Error('chart_of_accounts.system_category_is_fixed')
  }
}

/**
 * The category of this block that already answers to this name, if any.
 *
 * Archived ones do not count: they are absent from the picker, so the person
 * typing the name sees "Nenhuma categoria encontrada" and the "+ Criar
 * categoria" affordance (Figma 47:22). Refusing the name at that point would be
 * an error state no screen in the design has — e é o que faz a P11 funcionar
 * como decidida: recriar um nome arquivado cria registro novo. Ver o cabeçalho
 * de `archiveCategory`.
 */
function activeNamesake(
  categories: readonly Category[],
  blockId: BlockId,
  name: string,
): Category | null {
  const needle = normalizeForSearch(name)
  return (
    categories.find(
      (category) =>
        category.blockId === blockId &&
        !category.archived &&
        normalizeForSearch(category.name) === needle,
    ) ?? null
  )
}

function replaceCategory(chart: ChartOfAccounts, updated: Category): ChartOfAccounts {
  return {
    ...chart,
    categories: chart.categories.map((category) =>
      category.id === updated.id ? updated : category,
    ),
  }
}

/**
 * Whether a Lançamento of this kind may sit in a block with this cascade
 * effect. A block that ADDS (Receita Bruta) holds revenue; one that SUBTRACTS
 * holds expense; a Signed block (Resultado Financeiro, Não Operacional) and
 * the appropriation block hold both.
 *
 * Measured on 2026-09-29: a pró-labore typed in the Despesa tab with the
 * category "Salário/Pró-labore" — a Receita Bruta category — became an expense
 * INSIDE Receita Bruta, and subtracted from the revenue it was meant to be.
 */
export function blockAcceptsKind(effect: CascadeEffect, kind: 'Expense' | 'Revenue'): boolean {
  if (effect === 'Add') return kind === 'Revenue'
  if (effect === 'Subtract') return kind === 'Expense'
  return true
}

/**
 * The categories a Lançamento of this kind may be filed under — what the
 * Despesa and Receita tabs of Novo Lançamento offer. A category whose block is
 * unknown stays in (the server still checks, `entries.category_kind_mismatch`).
 */
export function categoriesForKind<C extends { readonly blockId: string }>(
  categories: readonly C[],
  blocks: readonly { readonly id: string; readonly effect: CascadeEffect }[],
  kind: 'Expense' | 'Revenue',
): C[] {
  return categories.filter((category) => {
    const block = blocks.find((b) => b.id === category.blockId)
    return block === undefined || blockAcceptsKind(block.effect, kind)
  })
}
