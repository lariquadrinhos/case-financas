/**
 * Pendência "N lançamentos a categorizar" (PRD v7.46) — o DOM medido, com
 * dados SINTÉTICOS (ADR-0009).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PendingItemsCard } from './pending-items-card'

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

beforeEach(() => {
  vi.stubGlobal('fetch', async (input: string) => {
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
    if (input.startsWith('/api/v1/entries?') && input.includes('categoryId=a-categorizar&')) {
      return json({
        data: [{ id: 'e1', amount: 30000, categoryId: 'a-categorizar' }],
        meta: { total: 1 },
      })
    }
    if (input.startsWith('/api/v1/entries?')) return json({ data: [], meta: { total: 0 } })
    if (input.startsWith('/api/v1/open-finance/entry-origins')) {
      return json({
        data: [
          {
            entryId: 'e1',
            kind: 'Expense',
            date: '2026-09-04',
            description: 'PIX ENVIADO SINTETICO',
            providerCategory: 'Transfer - PIX',
          },
        ],
        meta: { total: 1 },
      })
    }
    if (input.startsWith('/api/v1/categories')) {
      return json({
        data: [
          {
            id: 'a-categorizar',
            name: 'A categorizar',
            blockId: 'despesas-pessoais',
            isSystem: true,
            archived: false,
          },
          {
            id: 'aluguel-moradia',
            name: 'Aluguel moradia',
            blockId: 'despesas-administrativas',
            isSystem: false,
            archived: false,
          },
          {
            id: 'salario-sintetico',
            name: 'Salário sintético',
            blockId: 'receita-bruta',
            isSystem: false,
            archived: false,
          },
          {
            id: 'rendimento-sintetico',
            name: 'Rendimento sintético',
            blockId: 'resultado-financeiro',
            isSystem: false,
            archived: false,
          },
          {
            id: 'reserva-sintetica',
            name: 'Reserva sintética',
            blockId: 'destinacao-do-lucro',
            isSystem: false,
            archived: false,
          },
        ],
        meta: { total: 5 },
      })
    }
    if (input.startsWith('/api/v1/statement-blocks')) {
      return json({
        data: [
          { id: 'receita-bruta', name: 'Receita Bruta', effect: 'Add' },
          { id: 'despesas-administrativas', name: 'Despesas Administrativas', effect: 'Subtract' },
          { id: 'despesas-pessoais', name: 'Despesas Pessoais', effect: 'Subtract' },
          { id: 'resultado-financeiro', name: 'Resultado Financeiro', effect: 'Signed' },
          { id: 'destinacao-do-lucro', name: 'Destinação do Lucro', effect: 'None' },
        ],
        meta: { total: 5 },
      })
    }
    return json({ data: [], meta: { total: 0 } })
  })
})

afterEach(() => vi.unstubAllGlobals())

function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  })
  client.setQueryData(['pending-items'], {
    data: [
      {
        kind: 'Uncategorized',
        date: '2026-09-01',
        amount: null,
        item: { month: '2026-09', count: 12 },
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

describe('Pendência "a categorizar"', () => {
  it('PRD v7.46 — mostra a contagem do mês e abre a lista com a descrição do banco', async () => {
    const user = userEvent.setup()
    renderCard()
    expect(await screen.findByText('12 lançamentos a categorizar')).toBeInTheDocument()
    expect(screen.getByText('Vindos do banco em Setembro')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Categorizar agora' }))
    const lista = await screen.findByRole('list', { name: 'Lançamentos da categoria' })
    expect(await within(lista).findByText('PIX ENVIADO SINTETICO')).toBeInTheDocument()
    expect(within(lista).getByText('No banco: Transfer - PIX')).toBeInTheDocument()
    expect(
      within(lista).getByRole('combobox', { name: 'Categoria de PIX ENVIADO SINTETICO' }),
    ).toBeInTheDocument()
  })

  it('compra do cartão é despesa: o seletor oferece só categorias de blocos de despesa — nem receita, nem Resultado Financeiro, nem Destinação do Lucro', async () => {
    const user = userEvent.setup()
    renderCard()
    await user.click(await screen.findByRole('button', { name: 'Categorizar agora' }))
    const lista = await screen.findByRole('list', { name: 'Lançamentos da categoria' })
    await user.click(
      await within(lista).findByRole('combobox', { name: 'Categoria de PIX ENVIADO SINTETICO' }),
    )
    expect(await screen.findByRole('option', { name: /Aluguel moradia/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Salário sintético/ })).toBeNull()
    expect(screen.queryByRole('option', { name: /Rendimento sintético/ })).toBeNull()
    expect(screen.queryByRole('option', { name: /Reserva sintética/ })).toBeNull()
  })
})
