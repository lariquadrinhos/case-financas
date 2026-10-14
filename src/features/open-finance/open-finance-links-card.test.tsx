/**
 * Card Open Finance — o DOM medido, com contas SINTÉTICAS (ADR-0009): o
 * agrupamento por banco, as zeradas sem vínculo recolhidas e o seletor único
 * que também cria e desvincula (redesenho de 2026-09-29).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OpenFinanceLinksCard } from './open-finance-links-card'

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

// O Radix Select usa pointer capture e `scrollIntoView`, que o jsdom não
// implementa — o mesmo contorno de src/components/ui/select.test.tsx.
Element.prototype.scrollIntoView = () => {}
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}

const ACCOUNTS = [
  {
    id: 'a1',
    kind: 'Checking',
    name: 'Conta Sintética',
    numberSuffix: '0001',
    institution: 'Banco Zeta',
    balance: 150000,
    link: { target: { kind: 'BankAccount', bankAccountId: 'c1' }, linkedOn: '2026-09-01' },
  },
  {
    id: 'a2',
    kind: 'CreditCard',
    name: 'Cartão Sintético',
    numberSuffix: '0002',
    institution: 'Banco Zeta',
    balance: 5000,
    link: null,
  },
  {
    id: 'a3',
    kind: 'Checking',
    name: 'Outra Conta',
    numberSuffix: '0003',
    institution: 'Banco Alfa',
    balance: 1000,
    link: null,
  },
  {
    id: 'a4',
    kind: 'Checking',
    name: 'Pré-paga zerada',
    numberSuffix: '0004',
    institution: 'Banco Alfa',
    balance: 0,
    link: null,
  },
]

let requests: { method: string; url: string; body: unknown }[] = []

beforeEach(() => {
  requests = []
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    requests.push({ method, url: input, body: init?.body ? JSON.parse(String(init.body)) : null })
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      })
    if (input.endsWith('/open-finance/accounts'))
      return json({ data: ACCOUNTS, meta: { total: 4 } })
    if (input.endsWith('/open-finance/sync') && method === 'GET')
      return json({ lastSyncedAt: null, autoSync: true })
    if (input.endsWith('/accounts/a1/transactions')) {
      return json({
        data: [
          {
            id: 'm1',
            date: '2026-09-10',
            description: 'MERCADO SINTETICO',
            amount: 4590,
            direction: 'Out',
            providerCategory: 'Groceries',
            outcome: 'DiscretionaryExpense',
          },
          {
            id: 'm2',
            date: '2026-09-09',
            description: 'APLICACAO SINTETICA',
            amount: 10000,
            direction: 'Out',
            providerCategory: 'Automatic investment',
            outcome: 'Ignored',
          },
        ],
        meta: { total: 2 },
      })
    }
    return json({}, 201)
  })
})

afterEach(() => vi.unstubAllGlobals())

function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <OpenFinanceLinksCard
        kinds={['Checking', 'CreditCard']}
        options={[{ id: 'c1', label: 'Conta Um' }]}
      />
    </QueryClientProvider>,
  )
}

describe('OpenFinanceLinksCard', () => {
  it('agrupa por banco em ordem alfabética e recolhe as zeradas sem vínculo', async () => {
    const user = userEvent.setup()
    renderCard()
    const grupos = await screen.findAllByRole('region')
    expect(grupos.map((g) => g.getAttribute('aria-label'))).toEqual(['Banco Alfa', 'Banco Zeta'])
    expect(screen.queryByText('Pré-paga zerada')).toBeNull()

    await user.click(
      screen.getByRole('button', { name: 'Mostrar 1 conta(s) zerada(s) sem vínculo' }),
    )
    expect(screen.getByText('Pré-paga zerada')).toBeInTheDocument()
  })

  it('uma linha tem UM controle — sem PF/PJ nem botão soltos', async () => {
    renderCard()
    const zeta = await screen.findByRole('region', { name: 'Banco Zeta' })
    expect(within(zeta).getAllByRole('combobox')).toHaveLength(2)
    expect(within(zeta).queryByRole('radio')).toBeNull()
    expect(within(zeta).queryByRole('button', { name: /Criar e vincular|Desvincular/ })).toBeNull()
  })

  it('"+ Criar conta nova (PJ)" no seletor cria e vincula, com a entidade escolhida', async () => {
    const user = userEvent.setup()
    renderCard()
    const alfa = await screen.findByRole('region', { name: 'Banco Alfa' })
    await user.click(within(alfa).getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: '+ Criar conta nova (PJ)' }))
    await waitFor(() =>
      expect(requests).toContainEqual({
        method: 'POST',
        url: '/api/v1/open-finance/links/a3/position',
        body: { entity: 'PJ' },
      }),
    )
  })

  it('cartão não oferece "Criar": ele aponta para a conta que paga', async () => {
    const user = userEvent.setup()
    renderCard()
    const zeta = await screen.findByRole('region', { name: 'Banco Zeta' })
    await user.click(within(zeta).getAllByRole('combobox')[1]!)
    expect(await screen.findByRole('option', { name: 'Paga por Conta Um' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Criar/ })).toBeNull()
  })

  it('"Desvincular" fica no seletor da conta vinculada e apaga o vínculo', async () => {
    const user = userEvent.setup()
    renderCard()
    const zeta = await screen.findByRole('region', { name: 'Banco Zeta' })
    await user.click(within(zeta).getAllByRole('combobox')[0]!)
    await user.click(await screen.findByRole('option', { name: 'Desvincular' }))
    await waitFor(() =>
      expect(requests.some((r) => r.method === 'DELETE' && r.url.endsWith('/links/a1'))).toBe(true),
    )
  })

  it('expandir a conta mostra os movimentos do mês e o que cada um virou no Bigorna', async () => {
    const user = userEvent.setup()
    renderCard()
    const zeta = await screen.findByRole('region', { name: 'Banco Zeta' })
    const gatilho = within(zeta).getByRole('button', { name: /Conta corrente · final 0001/ })
    expect(gatilho).toHaveAttribute('aria-expanded', 'false')
    expect(requests.some((r) => r.url.includes('/transactions'))).toBe(false)

    await user.click(gatilho)
    const lista = await screen.findByRole('list', { name: 'Movimentos do mês' })
    expect(within(lista).getByText('MERCADO SINTETICO')).toBeInTheDocument()
    expect(within(lista).getByText('Consumo Livre')).toBeInTheDocument()
    expect(within(lista).getByText('Fora do DRE')).toBeInTheDocument()
  })

  it('2026-10-01 — "Sincronizar ao abrir o app" nasce ligado e desligar grava a preferência', async () => {
    const user = userEvent.setup()
    renderCard()
    const toggle = await screen.findByRole('switch', { name: 'Sincronizar ao abrir o app' })
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    await user.click(toggle)
    await waitFor(() =>
      expect(requests).toContainEqual({
        method: 'PUT',
        url: '/api/v1/open-finance/auto-sync',
        body: { enabled: false },
      }),
    )
  })
})
