/**
 * "Editar" numa recorrência abre o formulário já preenchido (pedido do dono,
 * 2026-10-01: "ao clicar em editar ele me direciona para tela de recorrência,
 * deveria já aparecer o modal de edição"; "não consigo atualizar todos os
 * dados da recorrência, como categoria"; "ele pode escolher como edita como tá
 * hoje"). Dados SINTÉTICOS (ADR-0009).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { apiPatch } from '@/lib/api-client'
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
  useSearchParams: () => new URLSearchParams('from=dre&occurrenceId=serie-1:2026-10'),
}))

const PF = {
  id: 'conta-pf',
  label: 'Conta PF Sintética',
  colour: 'nubank',
  entity: 'PF',
  balance: 0,
}

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client')
  return {
    ...actual,
    apiGet: vi.fn(async (path: string) => {
      if (path === '/bank-accounts') return { data: [PF], meta: { total: 1 } }
      if (path === '/categories') {
        return {
          data: [
            {
              id: 'cat-luz',
              blockId: 'despesas-pessoais',
              name: 'Luz sintética',
              isSystem: false,
              archived: false,
              suggestedClassification: 'Current',
            },
          ],
          meta: { total: 1 },
        }
      }
      if (path === '/occurrences/serie-1:2026-10') {
        return {
          id: 'serie-1:2026-10',
          recurrenceId: 'serie-1',
          month: '2026-10',
          plannedDate: '2026-10-10',
          plannedAmount: 12000,
          status: 'Planned',
          discarded: false,
          entryId: null,
        }
      }
      if (path === '/recurrences/serie-1') {
        return {
          id: 'serie-1',
          template: {
            kind: 'Expense',
            amount: 12000,
            entity: 'PF',
            categoryId: 'cat-luz',
            classification: 'Current',
            bankAccountId: 'conta-pf',
            description: 'Conta de luz sintética',
          },
          amountKind: 'Fixed',
          startDate: '2026-01-10',
          endsOn: null,
          closedOn: null,
        }
      }
      return { data: [], meta: { total: 0 } }
    }),
    apiPost: vi.fn(async () => ({})),
    apiPatch: vi.fn(async () => ({ data: [] })),
  }
})

function renderScreen() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <NovoLancamentoScreen />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(apiPatch).mockClear()
  push.mockClear()
})

describe('Editar recorrência no formulário (2026-10-01)', () => {
  it('abre preenchido com a série: título, descrição, valor e a escolha de alcance', async () => {
    renderScreen()
    expect(await screen.findByRole('heading', { name: 'Editar Recorrência' })).toBeInTheDocument()
    expect(await screen.findByDisplayValue('Conta de luz sintética')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Só esta ocorrência/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Toda a série/ })).not.toBeChecked()
  })

  it('"Toda a série": salvar manda valor, descrição e os dados da série ao PATCH da ocorrência, e volta ao DRE', async () => {
    const user = userEvent.setup()
    renderScreen()
    const descricao = await screen.findByDisplayValue('Conta de luz sintética')
    await user.clear(descricao)
    await user.type(descricao, 'Luz nova')
    await user.click(screen.getByRole('radio', { name: /Toda a série/ }))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(apiPatch).toHaveBeenCalled())
    const [path, body] = vi.mocked(apiPatch).mock.calls[0]!
    expect(path).toBe('/occurrences/serie-1:2026-10')
    expect(body).toMatchObject({
      plannedAmount: 12000,
      description: 'Luz nova',
      scope: 'WholeSeries',
      template: { kind: 'Expense', categoryId: 'cat-luz', bankAccountId: 'conta-pf' },
    })
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dre'))
  })

  it('"Só esta ocorrência" com só a descrição mudada não manda os dados da série', async () => {
    const user = userEvent.setup()
    renderScreen()
    const descricao = await screen.findByDisplayValue('Conta de luz sintética')
    await user.clear(descricao)
    await user.type(descricao, 'Só outubro')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(apiPatch).toHaveBeenCalled())
    const [, body] = vi.mocked(apiPatch).mock.calls[0]!
    expect(body).toMatchObject({ description: 'Só outubro', scope: 'ThisOnly' })
    expect(body).not.toHaveProperty('template')
  })

  it('relato de 2026-10-01 — "Cancelar" volta para a tela de onde o formulário foi aberto', async () => {
    const user = userEvent.setup()
    renderScreen()
    await screen.findByDisplayValue('Conta de luz sintética')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(push).toHaveBeenCalledWith('/dre')
  })
})
