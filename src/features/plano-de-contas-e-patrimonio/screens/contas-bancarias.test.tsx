import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ContasBancariasScreen } from './contas-bancarias'

/**
 * Figma `332:110` (docs/figma/frames/332-2__desktop-contas-bancarias.xml,
 * linhas 59-93): os 4 campos do card "Adicionar conta" são uma única linha,
 * na ordem Nome da conta (x=0) → Cor (x=321) → Entidade (x=565) → Saldo
 * (x=721). A implementação quebra a linha em 2 grids por largura, mas a
 * ORDEM de leitura/tab tem que preservar essa sequência — não reagrupar
 * Entidade com Cor e Saldo com Nome, como um `grid-cols-2` ingênuo faria.
 */
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

function renderWithQueryClient(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('Contas Bancárias — ordem dos campos de "Adicionar conta" (Figma 332:110)', () => {
  it('segue a ordem Nome da conta, Cor, Entidade, Saldo', () => {
    renderWithQueryClient(<ContasBancariasScreen />)

    const heading = screen.getByRole('heading', { name: 'Adicionar conta' })
    const card = heading.closest('div')?.parentElement as HTMLElement
    const labels = Array.from(card.querySelectorAll('label')).map((label) =>
      label.textContent?.replace(' *', ''),
    )

    expect(labels).toEqual(['Nome da conta', 'Cor', 'Entidade', 'Saldo'])
  })
})
