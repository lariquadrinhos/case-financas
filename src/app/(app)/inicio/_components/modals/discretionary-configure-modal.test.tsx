/**
 * Configurar Consumo Livre — verba fixa ou saldo da conta (2026-09-29). DOM
 * medido, contas SINTÉTICAS (ADR-0009).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DiscretionaryConfigureModal } from './discretionary-configure-modal'

Element.prototype.scrollIntoView = () => {}
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

let puts: unknown[] = []
beforeEach(() => {
  puts = []
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
    if (init?.method === 'PUT') {
      puts.push(JSON.parse(String(init.body)))
      return json(JSON.parse(String(init.body)))
    }
    if (input.startsWith('/api/v1/bank-accounts')) {
      return json({
        data: [
          { id: 'conta-1', label: 'Conta Sintética', colour: 'itau', entity: 'PF', balance: 0 },
        ],
        meta: { total: 1 },
      })
    }
    return json({ data: [], meta: { total: 0 } })
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('Configurar Consumo Livre — verba', () => {
  it('"Saldo da conta" dispensa o valor mensal e salva allowanceKind SourceBalance', async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <DiscretionaryConfigureModal open onOpenChange={() => {}} current={null} />
      </QueryClientProvider>,
    )
    expect(screen.getByText('Valor mensal')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Saldo da conta' }))
    expect(screen.queryByText('Valor mensal')).toBeNull()

    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'Conta Sintética' }))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(puts).toContainEqual(
        expect.objectContaining({ sourceAccountId: 'conta-1', allowanceKind: 'SourceBalance' }),
      ),
    )
  })
})
