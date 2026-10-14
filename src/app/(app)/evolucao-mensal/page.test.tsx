import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import EvolucaoMensalPage from './page'
import { assertReadingOrder } from '@/lib/testing/reading-order'

/**
 * P21 — decisão de produto de 2026-09-08, com a redação aprovada nesta mesma
 * conversa. Só o mês `until` carrega o Patrimônio Líquido medido (é o Balanço
 * verbatim); todos os anteriores saem do passo pra trás
 * `PL(mês) = PL(mês+1) − LucroLíquido(mês+1)`, conta que só fecha se o lucro
 * tiver sido a única coisa a mover o patrimônio. Corrigir um saldo à mão é
 * uma ação normal do produto (Contas Bancárias tem "Editar"), então a
 * divergência não é rara.
 *
 * Nenhum frame do Figma desenha esta nota: conferido no 23:2, a linha
 * "Patrimônio Líquido" é só rótulo e quatro valores. É a peça desta tela que
 * ainda precisa passar pelo time de design, e este teste trava o texto exato
 * enquanto isso, pra ninguém reescrever a frase sem passar pela decisão.
 */
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

const { fixture } = vi.hoisted(() => ({
  fixture: {
    view: 'Consolidated',
    range: 'LastSixMonths',
    points: [
      {
        month: '2026-06',
        revenue: 100_000,
        ebitda: 50_000,
        ebit: 50_000,
        netProfit: 50_000,
        netWorth: 700_000,
        netWorthIsReconstructed: true,
      },
      {
        month: '2026-07',
        revenue: 120_000,
        ebitda: 60_000,
        ebit: 60_000,
        netProfit: 60_000,
        netWorth: 1_000_000,
        netWorthIsReconstructed: false,
      },
    ],
  },
}))

vi.mock('@/lib/reports-client', () => ({
  fetchMonthlyTrend: vi.fn().mockResolvedValue(fixture),
}))

vi.mock('@/lib/use-report-view', () => ({
  useReportView: () => ['Consolidated', vi.fn()],
}))

vi.mock('@/lib/today', () => ({
  todayMonth: () => '2026-07',
  todayIsoDate: () => '2026-07-31',
}))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <EvolucaoMensalPage />
    </QueryClientProvider>,
  )
}

/**
 * Auditoria cruzada Figma ↔ código de 2026-09-08: os dois títulos desta tela
 * divergiam do desenho, e nenhum teste os cobria. Medido nó a nó no Mockup
 * "Desktop — Evolução Mensal (claro)":
 *
 *   `Card / Gráfico de evolução` › Título          → "Lucro Líquido por entidade"
 *   `Card / Detalhamento mês a mês` › Cabeçalho    → "Detalhamento mês a mês"
 *
 * O código escrevia "Lucro Líquido no período selecionado" no primeiro (texto
 * que descrevia o seletor logo abaixo, não o que o gráfico separa) e não
 * escrevia o segundo: a tabela entrava sem título nenhum.
 */
describe('Evolução Mensal — títulos dos cards (Mockup "Desktop — Evolução Mensal")', () => {
  it('o card do gráfico se chama "Lucro Líquido por entidade"', async () => {
    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Lucro Líquido por entidade' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Lucro Líquido no período selecionado')).not.toBeInTheDocument()
  })

  it('a tabela tem o cabeçalho "Detalhamento mês a mês"', async () => {
    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Detalhamento mês a mês' }),
    ).toBeInTheDocument()
  })
})

describe('Evolução Mensal — aviso de Patrimônio Líquido reconstruído (P21)', () => {
  it('mostra a nota aprovada quando algum ponto da série é reconstruído', async () => {
    renderPage()

    expect(
      await screen.findByText(
        /Só o Patrimônio Líquido do mês mais recente é medido\. Os anteriores são calculados a partir do lucro de cada mês, e podem divergir se você corrigiu algum saldo à mão\./,
      ),
    ).toBeInTheDocument()
  })
})

/**
 * P42 — ordem de leitura contra `docs/figma/frames/23-2__desktop-evolucao-mensal.xml`:
 * título → ajuda → seletor de visão → número herói → intervalo (Últimos 6
 * meses / Último ano) → gráfico → "Detalhamento mês a mês".
 */
describe('Evolução Mensal — ordem de leitura (P42, frame 23:2)', () => {
  it('título, visão, intervalo e a tabela aparecem nesta ordem', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Detalhamento mês a mês' })

    assertReadingOrder(
      [
        screen.getByRole('heading', { name: 'Evolução Mensal', level: 1 }),
        screen.getByRole('radio', { name: 'Consolidado' }),
        screen.getByRole('radio', { name: 'Últimos 6 meses' }),
        screen.getByRole('heading', { name: 'Detalhamento mês a mês' }),
      ],
      ['título', 'Consolidado', 'Últimos 6 meses', 'Detalhamento mês a mês'],
    )
  })
})
