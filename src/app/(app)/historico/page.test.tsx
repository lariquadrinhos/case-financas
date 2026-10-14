import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HistoricoPage from './page'
import { assertReadingOrder } from '@/lib/testing/reading-order'

/**
 * O filtro de Categoria do Histórico precisa oferecer categoria ARQUIVADA.
 *
 * Arquivar esconde a categoria das listas de escolha, não apaga o passado dela:
 * os Lançamentos antigos continuam apontando pro id e continuam contando no DRE
 * (`archiveCategory` só marca `archived: true`). Um filtro de Histórico olha
 * para trás — se ele lista só o que é usável, esses lançamentos aparecem no
 * total e não são encontráveis por ninguém.
 *
 * Medido antes da correção, com uma categoria arquivada na base sintética:
 * `/categories` devolvia 38 e `/categories?includeArchived=true` devolvia 39,
 * e a tela usava a primeira.
 *
 * A P11 (produto, 2026-09-08) tornou esse caso comum ao decidir que recriar uma
 * categoria arquivada cria um REGISTRO NOVO: passa a haver duas "Academia", e
 * sem esta consulta a metade antiga do histórico some do filtro.
 *
 * É falha silenciosa — o filtro parece funcionar, só não acha tudo —, e é por
 * isso que ela é travada aqui.
 */
vi.mock('@/features/historico/use-historico', () => ({
  useHistoricoEntries: () => ({ status: 'success', data: { data: [] }, refetch: vi.fn() }),
}))

const ATIVA = { id: 'alimentacao', name: 'Alimentação', archived: false }
const ARQUIVADA = { id: 'academia', name: 'Academia', archived: true }

const { chamadas } = vi.hoisted(() => ({ chamadas: [] as string[] }))

vi.mock('@/features/novo-lancamento/use-novo-lancamento', () => ({
  useBankAccounts: () => ({ data: { data: [] } }),
  useCategories: () => {
    chamadas.push('sem-arquivadas')
    return { data: { data: [ATIVA] } }
  },
  useCategoriesIncludingArchived: () => {
    chamadas.push('com-arquivadas')
    return { data: { data: [ATIVA, ARQUIVADA] } }
  },
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <HistoricoPage />
    </QueryClientProvider>,
  )
}

describe('Histórico — filtro de Categoria', () => {
  it('oferece a categoria arquivada, senão os lançamentos dela ficam infiltráveis', () => {
    renderPage()

    const filtro = screen.getByLabelText('Categoria')
    const rotulos = Array.from(filtro.querySelectorAll('option')).map((o) => o.textContent)

    expect(rotulos).toContain('Academia')
    expect(rotulos).toContain('Alimentação')
  })

  it('usa a consulta que inclui arquivadas, não a de escolher categoria', () => {
    chamadas.length = 0
    renderPage()

    expect(chamadas).toContain('com-arquivadas')
    expect(chamadas).not.toContain('sem-arquivadas')
  })
})

/**
 * P42 — ordem de leitura contra `docs/figma/frames/9-2__desktop-historico.xml`:
 * título → ajuda → a fila de sete filtros (Status, Entidade, Mês, Categoria,
 * Classificação, Conta, Recorrência) → a área de resultados. Aqui ela cai no
 * estado vazio (`309:94`), porque este arquivo mocka o Histórico sem
 * lançamentos — o que a ordem afirma é que os filtros vêm ANTES dela, e isso
 * vale nos dois estados. Filtro depois da tabela passaria pela auditoria de
 * texto, que só olha presença.
 */
describe('Histórico — ordem de leitura (P42, frame 9:2)', () => {
  it('título, o primeiro e o último filtro e a área de resultados aparecem nesta ordem', async () => {
    renderPage()
    await screen.findByText('Nenhum lançamento ainda')

    assertReadingOrder(
      [
        screen.getByRole('heading', { name: 'Histórico', level: 1 }),
        screen.getByLabelText('Status'),
        screen.getByLabelText('Recorrência'),
        screen.getByText('Nenhum lançamento ainda'),
      ],
      ['título', 'filtro Status', 'filtro Recorrência', 'área de resultados'],
    )
  })
})
