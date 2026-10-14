import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { VenderBemMaterialDialog } from './vender-bem-material-dialog'
import type { TangibleAsset } from '../types'

/**
 * files_design/03 "Objeto Direcionamento": "Destino | referência (Investimento
 * ou Passivo existente, busca/cria inline) ... | mesmo padrão de busca/criar
 * categoria (lista completa ao clicar, filtra ao digitar)" — a cláusula de
 * busca/filtro vale para o Destino inteiro, Investimento OU Passivo, sem
 * exceção nenhuma para Passivo. Medido ao vivo: com Tipo = Passivo, o campo
 * Destino era um <select> (Radix Select) sem caixa de busca — digitar não
 * filtrava a lista porque não havia onde digitar.
 */
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

const asset: TangibleAsset = {
  id: 'bem-sintetico-1',
  name: 'Bem Sintético',
  entity: 'PF',
  recordedValue: 10_000_000,
  soldOn: null,
}

function jsonResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <VenderBemMaterialDialog asset={asset} open onOpenChange={() => {}} />
    </QueryClientProvider>,
  )
}

describe('Vender Bem Material — Destino de Passivo (files_design/03 "Objeto Direcionamento")', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/v1/liabilities')) {
          return jsonResponse({
            data: [
              {
                id: 'liab-sintetico-1',
                name: 'Financiamento Sintético',
                creditor: 'Credor Sintético',
                entity: 'PF',
                classification: 'Current',
                originalAmount: 500000,
                installmentAmount: 50000,
                installmentCount: 10,
                installmentsAlreadyPaid: 0,
                monthlyInterestRate: 1,
                startDate: '2026-01-01',
              },
              {
                id: 'liab-sintetico-2',
                name: 'Cartão Sintético',
                creditor: 'Credor Sintético',
                entity: 'PF',
                classification: 'Current',
                originalAmount: 200000,
                installmentAmount: 20000,
                installmentCount: 5,
                installmentsAlreadyPaid: 0,
                monthlyInterestRate: 2,
                startDate: '2026-01-01',
              },
            ],
          })
        }
        return jsonResponse({ data: [] })
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('o Destino é um campo de busca (textbox), não um <select> só de existentes', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: '+ Adicionar Direcionamento' }))
    await user.click(screen.getByRole('radio', { name: 'Passivo' }))

    expect(screen.getByRole('textbox', { name: 'Destino' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Destino' })).not.toBeInTheDocument()
  })

  it('filtra a lista de passivos ao digitar, igual ao padrão de busca/criar categoria', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: '+ Adicionar Direcionamento' }))
    await user.click(screen.getByRole('radio', { name: 'Passivo' }))

    const destino = await screen.findByRole('textbox', { name: 'Destino' })
    fireEvent.focus(destino)
    fireEvent.change(destino, { target: { value: 'Cartão' } })

    expect(await screen.findByRole('button', { name: 'Cartão Sintético' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Financiamento Sintético' }),
    ).not.toBeInTheDocument()
  })
})
