import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fetchFinancialIndicators } from '@/lib/reports-client'
import IndicadoresFinanceirosPage from './page'
import { assertReadingOrder } from '@/lib/testing/reading-order'

/**
 * Fidelidade de layout da tela Indicadores Financeiros ao frame do Figma.
 *
 * MEDIDO nas duas páginas do arquivo, não deduzido:
 *
 * - Wireframe 25:2 (`docs/figma/frames/25-2__desktop-indicadores-financeiros.xml`),
 *   coluna de conteúdo `25:25`, x=48: `25:29` (controle segmentado de entidade,
 *   y=177) → `291:2` ("Navegue entre meses…", y=228) → `143:2` (seletor de mês,
 *   y=263, 141x32, em linha própria).
 * - Mockup 858:538, `858:571` "Barra de controles" (y=90) contém UMA instance,
 *   `858:572` "Controle segmentado" 199x38 → `858:582` (mesma legenda, y=136) →
 *   `858:575` "Seletor de mês" 188x36 (y=162), x=0, fora da barra de controles.
 *
 * Comparação de controle, para mostrar que a diferença é deliberada: no DRE
 * (Mockup 397:2) a barra `398:5` tem TRÊS filhos na mesma linha — `701:50`
 * (entidade, 199x38), `701:57` (Pago/Previsto, 144x38) e `398:19` (seletor de
 * mês, x=900). Nos Indicadores o seletor de mês desceu para a linha de baixo,
 * depois da legenda.
 *
 * - Carregando 309:83: exatamente 4 barras (`309:84`..`309:87`), larguras
 *   200/280/260/240 px, passo vertical de 26.
 */
/**
 * As chaves aqui são camelCase porque é isso que a API manda: o contrato é
 * `z.enum(INDICATOR_KEYS)` (`src/api/contracts/reports.ts`), e `INDICATOR_KEYS`
 * é camelCase. Estavam em PascalCase — um fixture que não podia ter vindo da
 * API, e que por isso escondia qualquer código que cruzasse a chave com o
 * catálogo do domínio.
 */
const { fixture } = vi.hoisted(() => ({
  fixture: {
    month: '2026-08',
    view: 'Consolidated',
    profitability: [{ key: 'grossMargin', label: 'Margem bruta', unit: '%', value: 87.5 }],
    liquidity: [{ key: 'currentRatio', label: 'Liquidez corrente', unit: 'x', value: 7 }],
    leverage: [{ key: 'debtRatio', label: 'Grau de endividamento', unit: '%', value: 41.6 }],
    netWorthGrowth: [
      { key: 'netWorthGrowth', label: 'Crescimento do PL (mês)', unit: '%', value: 1.5 },
    ],
    financialQualityOfLife: [
      { key: 'monthlyCostOfLiving', label: 'Custo de vida mensal', unit: 'BRL', value: 550000 },
    ],
  },
}))

vi.mock('@/lib/reports-client', () => ({
  fetchFinancialIndicators: vi.fn(),
}))

vi.mock('@/lib/use-report-view', () => ({
  useReportView: () => ['Consolidated', vi.fn()],
}))

vi.mock('@/lib/today', () => ({
  todayMonth: () => '2026-08',
  todayIsoDate: () => '2026-08-15',
}))

type Indicators = Awaited<ReturnType<typeof fetchFinancialIndicators>>

beforeEach(() => {
  vi.mocked(fetchFinancialIndicators).mockResolvedValue(fixture as unknown as Indicators)
})

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <IndicadoresFinanceirosPage />
    </QueryClientProvider>,
  )
}

const LEGEND_MONTHS =
  'Navegue entre meses: pra trás revê indicadores de meses passados; pra frente mostra a projeção baseada em recorrências e parcelas já configuradas.'

/** `a` vem antes de `b` na ordem do documento? */
function precedes(a: Element, b: Element): boolean {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
}

describe('Indicadores Financeiros — ordem dos controles (Figma 25:2 / Mockup 858:538)', () => {
  it('Figma 291:2 / 858:582 — o seletor de mês vem DEPOIS da legenda "Navegue entre meses"', async () => {
    renderPage()

    const viewSwitch = await screen.findByRole('radiogroup', { name: 'Visão' })
    const legend = screen.getByText(LEGEND_MONTHS)
    const previousMonth = screen.getByRole('button', { name: 'Mês anterior' })

    // 25:29 (y=177) → 291:2 (y=228) → 143:2 (y=263).
    expect(precedes(viewSwitch, legend)).toBe(true)
    expect(precedes(legend, previousMonth)).toBe(true)
  })

  it('Figma 858:571 — a barra de controles tem só o controle segmentado de entidade, sem o seletor de mês', async () => {
    renderPage()

    const viewSwitch = await screen.findByRole('radiogroup', { name: 'Visão' })
    const controlBar = viewSwitch.parentElement as HTMLElement

    expect(within(controlBar).queryByRole('button', { name: 'Mês anterior' })).toBeNull()
    expect(within(controlBar).queryByRole('button', { name: 'Próximo mês' })).toBeNull()
  })
})

describe('Indicadores Financeiros — estado Carregando (Figma 309:83)', () => {
  it('Figma 309:84..309:87 — desenha exatamente 4 barras', () => {
    vi.mocked(fetchFinancialIndicators).mockReturnValue(new Promise<Indicators>(() => {}))

    const { container } = renderPage()

    const status = container.querySelector('[role="status"]') as HTMLElement
    expect(status).not.toBeNull()
    expect(status.querySelectorAll('[aria-hidden="true"]')).toHaveLength(4)
  })
})

/**
 * P42 — ordem de leitura contra `docs/figma/frames/25-2__desktop-indicadores-financeiros.xml`:
 * título → ajuda → seletor de visão → navegação de mês → "Rentabilidade", a
 * primeira família de indicadores.
 */
describe('Indicadores Financeiros — ordem de leitura (P42, frame 25:2)', () => {
  it('título, visão, mês e a primeira família aparecem nesta ordem', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Rentabilidade', level: 2 })

    assertReadingOrder(
      [
        screen.getByRole('heading', { name: 'Indicadores Financeiros', level: 1 }),
        screen.getByRole('radio', { name: 'Consolidado' }),
        screen.getByRole('button', { name: 'Mês anterior' }),
        screen.getByRole('heading', { name: 'Rentabilidade', level: 2 }),
      ],
      ['título', 'Consolidado', 'mês', 'Rentabilidade'],
    )
  })
})

/**
 * Sugestão 7 do `files_design/05`, decidida em 2026-09-11: a tela **explica** o
 * que cada número é, e não julga se ele é bom.
 *
 * A sugestão original pedia faixas de referência ("liquidez saudável é acima de
 * 1,5"). Foi recusada e a recusa está no PRD, que proíbe faixa e cor de
 * julgamento — o limiar é conteúdo financeiro, varia por literatura e por
 * perfil, e vários destes 18 não têm referência universal possível ("Custo de
 * vida mensal" é um valor em reais).
 *
 * O que a pessoa precisava continuava real: ver o número e não saber o que ele
 * é. Isso se resolve explicando, com o mesmo `InfoTooltip` que o Novo Lançamento
 * já usa nos campos cuja opção não é auto-explicativa.
 */
describe('Indicadores Financeiros — a ajuda de cada indicador (doc05 §7)', () => {
  it('todo indicador da tela tem um "i" de ajuda com nome acessível próprio', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Rentabilidade', level: 2 })

    // O fixture desenha a família Rentabilidade; um botão de ajuda por linha.
    // Uma por linha desenhada: o fixture traz um indicador por família.
    for (const rotulo of [
      'Margem bruta',
      'Liquidez corrente',
      'Grau de endividamento',
      'Crescimento do PL (mês)',
      'Custo de vida mensal',
    ]) {
      expect(screen.getByRole('button', { name: `Ajuda sobre ${rotulo}` })).toBeInTheDocument()
    }
  })

  it('a ajuda diz o que o número É, sem dizer se ele é bom', async () => {
    renderPage()
    const ajuda = await screen.findByRole('button', { name: 'Ajuda sobre Margem bruta' })
    ajuda.focus()

    const texto = (await screen.findAllByText(/de cada R\$ 100 de receita/i))[0]
    expect(texto).toBeInTheDocument()
    // Nenhum veredito: o produto não diz "saudável", "bom", "ruim" nem "ideal".
    expect(document.body.textContent).not.toMatch(/saudável|recomendad|ideal|bom sinal/i)
  })
})
