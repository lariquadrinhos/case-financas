import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { InvestimentosScreen } from './investimentos'

/**
 * Figma `333:110` (docs/figma/frames/333-2__desktop-investimentos.xml,
 * linhas 59-83): os 3 campos do card "Adicionar investimento" são uma única
 * linha, na ordem Nome (x=0) → Entidade (x=443) → Valor inicial acumulado
 * (x=599). A implementação isolava Entidade numa linha própria APÓS
 * Nome/Valor inicial acumulado, invertendo a posição de Entidade e Valor
 * inicial acumulado.
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

describe('Investimentos — ordem dos campos de "Adicionar investimento" (Figma 333:110)', () => {
  it('segue a ordem Nome, Entidade, Valor inicial acumulado', () => {
    renderWithQueryClient(<InvestimentosScreen />)

    const heading = screen.getByRole('heading', { name: 'Adicionar investimento' })
    const card = heading.closest('div')?.parentElement as HTMLElement
    const labels = Array.from(card.querySelectorAll('label')).map((label) =>
      label.textContent?.replace(' *', ''),
    )

    expect(labels).toEqual(['Nome', 'Entidade', 'Valor inicial acumulado'])
  })
})
