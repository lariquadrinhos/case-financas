import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LinkToBankButton } from './link-to-bank-button'

/** "Vincular ao banco" (dono, 2026-10-09). Dados sintéticos. */

let posted: unknown[]

beforeEach(() => {
  posted = []
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const json = (body: unknown) =>
        Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        )
      if (init?.method === 'POST') {
        posted.push(JSON.parse(String(init.body)))
        return json({ id: 'manual-1', linkedToBank: true })
      }
      return json({
        data: [
          {
            transactionId: 'tx-1',
            date: '2026-10-08',
            amount: 100_050,
            description: 'TED recebida sintética',
            providerCategory: 'Transfer',
          },
        ],
        meta: { total: 1 },
      })
    }),
  )
})

afterEach(() => vi.unstubAllGlobals())

function renderButton() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <LinkToBankButton entryId="manual-1" entryName="Depósito sintético" />
    </QueryClientProvider>,
  )
}

describe('LinkToBankButton', () => {
  it('dono 2026-10-09 — lista as transações candidatas e vincula a escolhida', async () => {
    const user = userEvent.setup()
    renderButton()
    await user.click(screen.getByRole('button', { name: 'Vincular ao banco' }))
    const opcao = await screen.findByRole('radio', { name: /TED recebida sintética/ })
    expect(opcao).toHaveTextContent('08/10/2026')
    expect(opcao).toHaveTextContent(/R\$\s1\.000,50/)
    await user.click(opcao)
    await user.click(screen.getByRole('button', { name: 'Vincular' }))
    await vi.waitFor(() => expect(posted).toEqual([{ transactionId: 'tx-1' }]))
  })
})
