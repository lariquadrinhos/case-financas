import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BlockAccordionRow } from './block-accordion-row'
import type { StatementBlock } from '@/features/plano-de-contas-e-patrimonio/types'

vi.mock('@/features/plano-de-contas-e-patrimonio/chart-of-accounts', () => ({
  categories: {
    usePatch: () => ({ mutate: vi.fn(), isPending: false }),
    useCreate: () => ({ mutate: vi.fn(), isPending: false }),
  },
  useArchiveCategory: () => ({ mutate: vi.fn(), isPending: false }),
}))

const block: StatementBlock = {
  id: 'despesas-pessoais',
  name: 'Despesas Pessoais/Consumo',
  order: 5,
  effect: 'Subtract',
  belowTheLine: false,
  acceptsUserCategories: true,
  statementLabel: null,
}

function renderWithQueryClient(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

/**
 * Este é o frame do próprio Onboarding 1: Wireframe 44:2, nó 121:2, medido no
 * XML (docs/figma/frames/44-2__onboarding-1-bloco-de-categoria-expandido-exemplo.xml).
 * A linha de criar categoria mede 572 e é partida em duas colunas IGUAIS de
 * 282 com 8 de vão (121:3 em x=0 w=282; 202:16 em x=290 w=282), e o botão
 * 121:5 (x=153 dentro da segunda coluna, w=129) termina em 572 — encostado na
 * borda direita da linha.
 *
 * O que estava aqui era `flex` com o campo em `flex-1`: o campo comia todo o
 * espaço que o botão não usasse, o que não é 282 de 572 e deixava esta tela
 * discordando da tela pós-onboarding, que files_design/01 §10 manda
 * reaproveitar este mesmo conteúdo.
 */
describe('BlockAccordionRow — Figma 44:2 nó 121:2', () => {
  it('Figma 44:2 nó 121:2 — duas colunas iguais (282+8+282), botão na borda direita', async () => {
    renderWithQueryClient(
      <BlockAccordionRow block={block} categoryList={[]} expanded onToggle={vi.fn()} />,
    )

    const button = await screen.findByRole('button', { name: '+ Criar categoria' })
    const row = button.parentElement
    expect(row?.className).toContain('grid-cols-2')
    expect(row?.className).toContain('gap-8')
    expect(row?.className).not.toContain('flex')
    expect(button.className).toContain('justify-self-end')
  })

  it('Figma 44:2 nó 121:4 — o campo diz "Nome da categoria *"', async () => {
    renderWithQueryClient(
      <BlockAccordionRow block={block} categoryList={[]} expanded onToggle={vi.fn()} />,
    )

    expect(await screen.findByLabelText('Nome da categoria *')).toBeInTheDocument()
  })
})

/**
 * files_design/07 §328, "Linha expansível": o cabeçalho leva
 * `icon/chevron-right` (recolhido) ou `icon/chevron-down` (expandido) — os
 * componentes 470:4 e 470:2 do Style guide (frame 544:460 → 471:7 / 471:5),
 * 20×20, traço 1,5.
 *
 * O DEFEITO que este teste trava: aqui era um GLIFO DE TEXTO (`{expanded ?
 * '▾' : '▸'}`), justificado no comentário como "match the ones already shipped
 * in Sidebar rather than a new icon component". A barra lateral também usava
 * glifo, e também estava errada (Mockup 749:12 / 749:28 são instâncias de
 * `icon/*`); os dois foram para o mesmo componente compartilhado.
 */
describe('BlockAccordionRow — chevron (files_design/07 §328, Style guide 470:2 / 470:4)', () => {
  it('470:2 — expandido usa icon/chevron-down, não um glifo de texto', () => {
    const { container } = renderWithQueryClient(
      <BlockAccordionRow block={block} categoryList={[]} expanded onToggle={vi.fn()} />,
    )

    const header = screen.getByRole('button', { name: /Despesas Pessoais\/Consumo/ })

    expect(header.textContent).not.toMatch(/[▾▸]/)
    // Vetor do master 470:3: 8×4 em (6,8) na caixa de 20×20.
    expect(container.querySelector('h3 svg path')?.getAttribute('d')).toBe('M6 8L10 12L14 8')
  })

  it('470:4 — recolhido usa icon/chevron-right, não um glifo de texto', () => {
    const { container } = renderWithQueryClient(
      <BlockAccordionRow block={block} categoryList={[]} expanded={false} onToggle={vi.fn()} />,
    )

    const header = screen.getByRole('button', { name: /Despesas Pessoais\/Consumo/ })

    expect(header.textContent).not.toMatch(/[▾▸]/)
    // Vetor do master 470:5: 4×8 em (8,6).
    expect(container.querySelector('h3 svg path')?.getAttribute('d')).toBe('M8 6L12 10L8 14')
  })
})
