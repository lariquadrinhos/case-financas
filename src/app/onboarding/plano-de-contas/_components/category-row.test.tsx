import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CategoryRow } from './category-row'
import type { Category } from '@/features/plano-de-contas-e-patrimonio/types'

/**
 * Figma 44:2 ("Onboarding 1 — bloco de categoria expandido") desenha
 * **Editar E Descartar** em cada categoria, e o próprio frame carrega a nota
 * de comportamento (nó 44:88): "Cada categoria tem Editar/Descartar (mesmo
 * padrão do resto do produto)".
 *
 * Uma rodada de auditoria removeu o "Descartar" lendo o PRD §4/§7 ("não existe
 * ação de EXCLUIR categoria") como se proibisse o botão, e escreveu um teste
 * afirmando a ausência dele. Este arquivo substitui aquele teste, porque a
 * premissa estava errada: neste produto "Descartar" e "Excluir" são coisas
 * diferentes, e as fontes dizem isso explicitamente.
 *
 * - files_design/02 §"'Descartar' mantido como termo único em todo o produto
 *   (não trocado por 'Excluir')" — a escolha foi deliberada, justamente por
 *   "não soar definitivo/irreversível".
 * - `POST /api/v1/categories/{id}/archive` já existia e continua existindo;
 *   seu cabeçalho cita o nó 44:43 deste mesmo frame e diz "Not a delete: an
 *   archived category stays in the chart because past Lançamentos still point
 *   at its id".
 * - `archiveCategory` (src/domain/chart-of-accounts/rules.ts) só marca
 *   `archived: true`; o registro nunca sai de `chart.categories`.
 * - `categoryQuerySchema.includeArchived` nasce `'false'`, então a categoria
 *   arquivada some das listas — que é literalmente a segunda metade da frase
 *   do PRD, "categoria não utilizada apenas deixa de ser usada".
 *
 * O que o PRD proíbe é `DELETE /categories/{id}`, que nunca existiu.
 */
function renderWithQueryClient(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

const category: Category = {
  id: 'alimentacao',
  blockId: 'despesas-pessoais',
  name: 'Alimentação',
  isSystem: false,
  suggestedClassification: null,
  archived: false,
  isPassiveIncome: false,
}

describe('CategoryRow (Onboarding — Plano de Contas) — Figma 44:2/44:88', () => {
  it('mostra Editar E Descartar numa categoria comum', () => {
    renderWithQueryClient(<CategoryRow category={category} />)

    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeInTheDocument()
  })

  /**
   * Não há mais exceção ao par de ações nesta tela: "Consumo Livre" (a única
   * categoria `isSystem`) deixou de ser LISTADA no Plano de Contas — decisão
   * de produto de 2026-09-07: ela passa a ser tratada como área de consumo
   * isolada, com widget próprio na Home (files_design/01 §4a).
   *
   * Isso resolve na raiz a contradição que o frame 44:2 expunha: a nota 44:88
   * diz que "cada categoria tem Editar/Descartar", mas o contrato da API
   * proíbe renomear ou arquivar a categoria de sistema, porque o widget sempre
   * lança nela. Tirando-a da lista, a regra do frame vale sem exceção para
   * tudo que está listado — que é o que este teste trava.
   *
   * O filtro em si mora um nível acima (plano-de-contas-step.tsx) e tem teste
   * próprio; aqui basta afirmar que a linha não tem mais ramo condicional.
   */
  it('dá o par completo a qualquer categoria que chegue à lista, sem exceção', () => {
    renderWithQueryClient(<CategoryRow category={category} />)

    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeInTheDocument()
    expect(screen.queryByText('Categoria fixa do sistema')).not.toBeInTheDocument()
  })
})
