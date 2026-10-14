import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fetchBalanceSheet } from '@/lib/reports-client'
import BalancoPatrimonialPage from './page'
import { assertReadingOrder } from '@/lib/testing/reading-order'

/**
 * Fidelidade ao Figma do Balanço Patrimonial.
 *
 * Fatos medidos (não deduzidos), citando o nó exato:
 *
 * - Wireframe `21:2` (docs/figma/frames/21-2__desktop-balanco-patrimonial.xml):
 *   dentro do card "Ativo" (21:38) vêm CINCO linhas irmãs de 483×32, sem
 *   nenhum cabeçalho entre elas — "Contas bancárias (Nubank, Itaú PJ)"
 *   (circulante) e "Imóvel"/"Veículo"/"Investimentos" (não circulante) estão na
 *   MESMA lista. `grep -rni circulante docs/figma/frames/` não devolve UM hit
 *   em nenhum frame de Balanço.
 * - Mockup `848:50` → `Card / Ativo` (848:46) e `Card / Passivo + Patrimônio
 *   Líquido` (848:48): a mesma lista plana, agora com os componentes nomeados
 *   `Linha / linha` (44px), `Linha / subtotal` (848:36, faixa
 *   `superficie-sutil`) e `Linha / final` (848:23 e 848:41, 58px, régua
 *   `borda-forte` + `numeric.lg`).
 * - Vazio: Mockup `1030:3256` e Wireframe `310:455` desenham só o h1 e o
 *   primeiro parágrafo no cabeçalho — sem "Veja o balanço consolidado…", sem
 *   Controle segmentado e sem "posição em …".
 */
const { fixture } = vi.hoisted(() => ({
  fixture: {
    view: 'Consolidated',
    asOf: '2026-07-20',
    currentAssets: {
      total: 840_000,
      items: [
        {
          source: { kind: 'BankAccount', bankAccountId: 'acc-1' },
          label: 'Contas bancárias (Nubank, Itaú PJ)',
          entity: 'PF',
          amount: 840_000,
        },
      ],
    },
    nonCurrentAssets: {
      total: 42_700_000,
      items: [
        {
          source: { kind: 'TangibleAsset', tangibleAssetId: 'asset-1' },
          label: 'Imóvel',
          entity: 'PF',
          amount: 32_000_000,
        },
        {
          source: { kind: 'Investment', investmentId: 'inv-1' },
          label: 'Investimentos (Tesouro, Ações)',
          entity: 'PF',
          amount: 6_200_000,
        },
      ],
    },
    currentLiabilities: {
      total: 120_000,
      items: [
        {
          source: { kind: 'Liability', liabilityId: 'lia-1' },
          label: 'Cartão de crédito',
          entity: 'PF',
          amount: 120_000,
        },
      ],
    },
    nonCurrentLiabilities: {
      total: 18_000_000,
      items: [
        {
          source: { kind: 'Liability', liabilityId: 'lia-2' },
          label: 'Financiamento imóvel',
          entity: 'PF',
          amount: 18_000_000,
        },
      ],
    },
    totalAssets: 43_540_000,
    totalLiabilities: 18_120_000,
    netWorth: 25_420_000,
  },
}))

const EMPTY_SHEET = {
  view: 'Consolidated',
  asOf: '2026-07-20',
  currentAssets: { total: 0, items: [] },
  nonCurrentAssets: { total: 0, items: [] },
  currentLiabilities: { total: 0, items: [] },
  nonCurrentLiabilities: { total: 0, items: [] },
  totalAssets: 0,
  totalLiabilities: 0,
  netWorth: 0,
}

vi.mock('@/lib/reports-client', () => ({
  fetchBalanceSheet: vi.fn(),
}))

vi.mock('@/lib/use-report-view', () => ({
  useReportView: () => ['Consolidated', vi.fn()],
}))

vi.mock('@/lib/today', () => ({
  todayIsoDate: () => '2026-07-20',
}))

type Sheet = Awaited<ReturnType<typeof fetchBalanceSheet>>

function mockSheet(sheet: unknown) {
  vi.mocked(fetchBalanceSheet).mockResolvedValue(sheet as Sheet)
}

beforeEach(() => {
  vi.mocked(fetchBalanceSheet).mockReset()
  mockSheet(fixture)
})

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <BalancoPatrimonialPage />
    </QueryClientProvider>,
  )
}

describe('Balanço Patrimonial — Figma 21:2 / Mockup 848:50: lista plana dentro do card', () => {
  it('não imprime cabeçalho de sub-grupo "Circulante" nem "Não circulante"', async () => {
    renderPage()

    await screen.findByText('Total do Ativo')

    expect(screen.queryByText('Circulante')).toBeNull()
    expect(screen.queryByText('Não circulante')).toBeNull()
  })

  it('põe circulante e não circulante na MESMA lista do card Ativo (21:44 e 21:52 são irmãos)', async () => {
    renderPage()

    const bank = await screen.findByText('Contas bancárias (Nubank, Itaú PJ)')
    const property = screen.getByText('Imóvel')

    expect(bank.closest('ul')).not.toBeNull()
    expect(property.closest('ul')).toBe(bank.closest('ul'))
  })

  it('desenha "Total do Passivo" como Linha / subtotal (848:36, faixa superficie-sutil, sem régua)', async () => {
    renderPage()

    const row = (await screen.findByText('Total do Passivo')).closest('div')

    expect(row?.className).toContain('bg-surface-subtle')
    expect(row?.className).not.toContain('border-t')
  })

  it('desenha "Patrimônio Líquido" como Linha / final (848:41, régua borda-forte + numeric.lg)', async () => {
    renderPage()

    const label = await screen.findByText('Patrimônio Líquido')
    const row = label.closest('div')

    expect(row?.className).toContain('border-t')
    expect(row?.className).toContain('border-line-strong')
    expect(row?.querySelector('.text-style-numeric-lg')).not.toBeNull()
  })
})

describe('Balanço Patrimonial vazio — Mockup 1030:3256 / Wireframe 310:455', () => {
  beforeEach(() => {
    mockSheet(EMPTY_SHEET)
  })

  it('mostra só o h1 e o primeiro parágrafo: sem Controle segmentado e sem "posição em"', async () => {
    renderPage()

    await screen.findByText('Nada cadastrado ainda')

    expect(screen.queryByRole('radiogroup', { name: 'Visão' })).toBeNull()
    expect(screen.queryByText(/posição em/)).toBeNull()
    expect(screen.queryByText(/Veja o balanço consolidado/)).toBeNull()
    expect(
      screen.getByText(/Balanço Patrimonial: uma foto de tudo que você tem/),
    ).toBeInTheDocument()
  })
})

/**
 * P42 — ordem de leitura contra `docs/figma/frames/21-2__desktop-balanco-patrimonial.xml`:
 * título → ajuda → seletor de visão → "posição em …" → "Ativo" → "Passivo +
 * Patrimônio Líquido". As duas colunas na ordem inversa passariam pela
 * auditoria de texto, que só olha presença.
 */
describe('Balanço Patrimonial — ordem de leitura (P42, frame 21:2)', () => {
  it('título, visão, Ativo e Passivo aparecem nesta ordem', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Ativo', level: 2 })

    assertReadingOrder(
      [
        screen.getByRole('heading', { name: 'Balanço Patrimonial', level: 1 }),
        screen.getByRole('radio', { name: 'Consolidado' }),
        screen.getByRole('heading', { name: 'Ativo', level: 2 }),
        screen.getByRole('heading', { name: 'Passivo + Patrimônio Líquido', level: 2 }),
      ],
      ['título', 'Consolidado', 'Ativo', 'Passivo + Patrimônio Líquido'],
    )
  })
})
