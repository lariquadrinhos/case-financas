import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BensMateriaisScreen } from './bens-materiais'

/**
 * Figma `96:139` (docs/figma/frames/93-15__desktop-bens-materiais.xml, linhas
 * 57-83): os 3 campos do card "Adicionar bem material" são uma única linha,
 * na ordem Nome (x=0) → Entidade (x=347) → Valor inicial (x=694). A
 * implementação isolava Entidade numa linha própria APÓS Nome/Valor inicial,
 * invertendo a posição de Entidade e Valor inicial.
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

describe('Bens Materiais — ordem dos campos de "Adicionar bem material" (Figma 96:139)', () => {
  it('segue a ordem Nome, Entidade, Valor inicial', () => {
    renderWithQueryClient(<BensMateriaisScreen />)

    const heading = screen.getByRole('heading', { name: 'Adicionar bem material' })
    const card = heading.closest('div')?.parentElement as HTMLElement
    const labels = Array.from(card.querySelectorAll('label')).map((label) =>
      label.textContent?.replace(' *', ''),
    )

    expect(labels).toEqual(['Nome', 'Entidade', 'Valor inicial'])
  })
})
