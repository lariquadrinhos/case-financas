import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HistoricoPage from './page'

/**
 * "Descartar lançamento" direto na linha do Histórico (pedido de produto,
 * 2026-09-23). A linha inteira abre a edição; o descarte é uma ação à parte e
 * não pode navegar — nem pelo botão, nem pelos cliques dentro da confirmação.
 * Dados sintéticos.
 */

const { push, apiDelete } = vi.hoisted(() => ({
  push: vi.fn(),
  apiDelete: vi.fn(async () => undefined),
}))

const CATEGORIA = { id: 'cat-sintetica', name: 'Categoria sintética', archived: false }
const LANCAMENTO = {
  id: 'entry-1',
  kind: 'Expense',
  amount: 10_000,
  date: '2026-07-10',
  status: 'Paid',
  recurrenceId: 'rec-1',
  entity: 'PF',
  categoryId: CATEGORIA.id,
  classification: 'Current',
  bankAccountId: 'acc-1',
  isCreditCard: true,
}

vi.mock('@/features/historico/use-historico', () => ({
  useHistoricoEntries: () => ({
    status: 'success',
    data: { data: [LANCAMENTO] },
    refetch: vi.fn(),
  }),
}))
vi.mock('@/features/novo-lancamento/use-novo-lancamento', () => ({
  useBankAccounts: () => ({ data: { data: [] } }),
  useCategoriesIncludingArchived: () => ({ data: { data: [CATEGORIA] } }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/api-client', async (original) => ({
  ...(await original<typeof import('@/lib/api-client')>()),
  apiDelete,
}))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <HistoricoPage />
    </QueryClientProvider>,
  )
}

describe('Histórico — Descartar lançamento na linha', () => {
  beforeEach(() => {
    push.mockClear()
    apiDelete.mockClear()
  })

  it('2026-10-01 — o lançamento de uma série diz "Recorrente" ao lado do nome', () => {
    renderPage()
    const row = screen
      .getAllByText('Categoria sintética')
      .map((el) => el.closest('tr'))
      .find((tr) => tr !== null) as HTMLElement
    expect(within(row).getByRole('img', { name: 'Recorrente' })).toBeInTheDocument()
  })

  it('dono 2026-10-09 — um lançamento feito à mão oferece "Vincular ao banco", sem abrir a edição', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Vincular ao banco' }))
    expect(push).not.toHaveBeenCalled()
    expect(await screen.findByRole('dialog', { name: /Vincular/ })).toBeInTheDocument()
  })

  it('ADR-0021 — a despesa do cartão mostra o ícone "Cartão de crédito" ao lado do nome', () => {
    renderPage()
    const row = screen
      .getAllByText('Categoria sintética')
      .map((el) => el.closest('tr'))
      .find((tr) => tr !== null) as HTMLElement
    expect(within(row).getByRole('img', { name: 'Cartão de crédito' })).toBeInTheDocument()
  })

  it('o botão abre a confirmação sem abrir a edição da linha', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Descartar' }))

    expect(
      screen.getByRole('dialog', { name: 'Descartar "Categoria sintética"?' }),
    ).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it('confirmar descarta o lançamento, sem navegar', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Descartar' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Descartar' }))

    expect(apiDelete).toHaveBeenCalledWith('/entries/entry-1')
    expect(push).not.toHaveBeenCalled()
  })

  it('lançamento de recorrência oferece encerrar a série junto', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Descartar' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('switch', { name: 'Encerrar a recorrência também' }))
    await user.click(within(dialog).getByRole('button', { name: 'Descartar' }))

    expect(apiDelete).toHaveBeenCalledWith('/entries/entry-1?closeRecurrence=true')
  })
})
