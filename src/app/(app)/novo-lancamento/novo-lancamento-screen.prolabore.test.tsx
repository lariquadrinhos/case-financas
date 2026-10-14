/**
 * Pró-labore salvo de ponta a ponta no formulário — reprodução do relato de
 * 2026-09-29 ("o lançamento de pró-labore não está acontecendo": nenhum POST no
 * log). Contas SINTÉTICAS (ADR-0009).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { apiPost } from '@/lib/api-client'
import { NovoLancamentoScreen } from './novo-lancamento-screen'

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

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}))

const PF = {
  id: 'conta-pf',
  label: 'Conta PF Sintética',
  colour: 'nubank',
  entity: 'PF',
  balance: 0,
}
const PJ = { id: 'conta-pj', label: 'Conta PJ Sintética', colour: 'itau', entity: 'PJ', balance: 0 }

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client')
  return {
    ...actual,
    apiGet: vi.fn(async (path: string, query?: { entity?: string }) => {
      if (path === '/bank-accounts') {
        const all = [PF, PJ]
        const data = query?.entity ? all.filter((a) => a.entity === query.entity) : all
        return { data, meta: { total: data.length } }
      }
      return { data: [], meta: { total: 0 } }
    }),
    apiPost: vi.fn(async () => ({})),
    apiPatch: vi.fn(async () => ({})),
  }
})

beforeEach(() => {
  vi.mocked(apiPost).mockClear()
  push.mockClear()
})

describe('Novo Lançamento — Pró-labore salva', () => {
  it('relato de 2026-09-29: preencher o pró-labore e salvar faz o POST /entries', async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <NovoLancamentoScreen />
      </QueryClientProvider>,
    )
    await user.click(screen.getByRole('tab', { name: 'Pró-labore e Distribuição' }))
    await user.type(screen.getByRole('textbox', { name: /^Valor/ }), '1000')
    await user.click(screen.getByRole('combobox', { name: /Conta de destino/ }))
    await user.click(await screen.findByRole('option', { name: 'Conta PF Sintética' }))
    await user.click(screen.getByRole('button', { name: 'Salvar Lançamento' }))

    await waitFor(() => expect(apiPost).toHaveBeenCalled())
    const [path, body] = vi.mocked(apiPost).mock.calls[0]!
    expect(path).toBe('/entries')
    expect(body).toMatchObject({ kind: 'ProLabore', destinationAccountId: 'conta-pf' })
  })

  it('relato de 2026-09-29: sem a conta de destino, não fica mudo — diz ao lado do botão o que falta', async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <NovoLancamentoScreen />
      </QueryClientProvider>,
    )
    await user.click(screen.getByRole('tab', { name: 'Pró-labore e Distribuição' }))
    await user.click(screen.getByRole('button', { name: 'Salvar Lançamento' }))

    expect(apiPost).not.toHaveBeenCalled()
    const aviso = await screen.findByText(/O lançamento não foi salvo/)
    expect(aviso).toHaveAttribute('role', 'alert')
    expect(aviso).toHaveTextContent('Conta de destino (PF)')
  })

  async function preencherProLabore() {
    const user = userEvent.setup()
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <NovoLancamentoScreen />
      </QueryClientProvider>,
    )
    await user.click(screen.getByRole('tab', { name: 'Pró-labore e Distribuição' }))
    await user.type(screen.getByRole('textbox', { name: /Descrição/ }), 'Pró-labore sintético')
    await user.click(screen.getByRole('combobox', { name: /Conta de destino/ }))
    await user.click(await screen.findByRole('option', { name: 'Conta PF Sintética' }))
    return user
  }

  it('2026-10-01 — um botão de salvar só: com "Lançar outro em seguida" ligado, salva, limpa e continua no formulário, e a opção fica ligada', async () => {
    const user = await preencherProLabore()
    expect(screen.queryByRole('button', { name: 'Salvar e lançar outro' })).toBeNull()
    const lancarOutro = screen.getByRole('switch', { name: 'Lançar outro em seguida' })
    expect(lancarOutro).toHaveAttribute('aria-checked', 'false')
    await user.click(lancarOutro)
    await user.click(screen.getByRole('button', { name: 'Salvar Lançamento' }))

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1))
    expect(push).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent('Lançamento salvo com sucesso.')
    expect(screen.getByRole('textbox', { name: /Descrição/ })).toHaveValue('')
    expect(screen.getByRole('switch', { name: 'Lançar outro em seguida' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('2026-10-01 — com "Lançar outro em seguida" desligado (o padrão), "Salvar Lançamento" salva e fecha', async () => {
    const user = await preencherProLabore()
    await user.click(screen.getByRole('button', { name: 'Salvar Lançamento' }))
    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(push).toHaveBeenCalled())
  })
})
