/**
 * Pendência "transferência a classificar" (2026-09-29) — DOM medido, dados
 * SINTÉTICOS (ADR-0009).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PendingItemsCard } from './pending-items-card'

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

let posts: { url: string; body: unknown }[] = []
beforeEach(() => {
  posts = []
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
    if (init?.method === 'POST') posts.push({ url: input, body: JSON.parse(String(init.body)) })
    return new Response(JSON.stringify({ data: [], meta: { total: 0 } }), {
      headers: { 'content-type': 'application/json' },
    })
  })
})
afterEach(() => vi.unstubAllGlobals())

function renderCard(from: 'PF' | 'PJ', to: 'PF' | 'PJ') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  })
  client.setQueryData(['pending-items'], {
    data: [
      {
        kind: 'UnclassifiedTransfer',
        date: '2026-09-05',
        amount: 500000,
        item: {
          transactionId: 'tx-sintetica',
          from,
          to,
          fromBankAccountId: 'a',
          toBankAccountId: 'b',
          description: 'PIX SINTETICO',
        },
      },
    ],
    meta: { total: 1 },
  })
  return render(
    <QueryClientProvider client={client}>
      <PendingItemsCard categories={[]} />
    </QueryClientProvider>,
  )
}

describe('Pendência — transferência entre PJ e PF', () => {
  it('PJ→PF mostra o valor e o sentido, e oferece Pró-labore, Distribuição de lucro ou Só transferência', async () => {
    const user = userEvent.setup()
    renderCard('PJ', 'PF')
    expect(await screen.findByText(/de PJ para PF/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Classificar agora' }))
    expect(await screen.findByRole('button', { name: /Pró-labore/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Distribuição de lucro/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Só transferência/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Aporte na PJ/ })).toBeNull()

    await user.click(screen.getByRole('button', { name: /Pró-labore/ }))
    await waitFor(() =>
      expect(posts).toContainEqual({
        url: '/api/v1/open-finance/transfers/tx-sintetica/classification',
        body: { classification: 'ProLabore' },
      }),
    )
  })

  it('PF→PJ oferece Aporte na PJ ou Só transferência, nunca Pró-labore', async () => {
    const user = userEvent.setup()
    renderCard('PF', 'PJ')
    await user.click(await screen.findByRole('button', { name: 'Classificar agora' }))
    expect(await screen.findByRole('button', { name: /Aporte na PJ/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pró-labore/ })).toBeNull()
  })
})
