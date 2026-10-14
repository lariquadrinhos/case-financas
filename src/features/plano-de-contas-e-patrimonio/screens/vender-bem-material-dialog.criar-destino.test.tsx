import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { VenderBemMaterialDialog } from './vender-bem-material-dialog'
import type { TangibleAsset } from '../types'

/**
 * Frame 103:21 "Estado — Adicionar Direcionamento (Investimento)" (página
 * Wireframe, docs/figma/frames/103-21__*.xml) desenha o sub-formulário
 * inteiro. Três nós dele estavam contrariados no código:
 *
 *   103:35/103:36 + 202:20 — uma linha própria, divisor à esquerda e botão
 *     "+ Adicionar" à direita, DEPOIS dos campos e ANTES do rodapé.
 *   103:37 — "Abre o formulário completo de cadastro de investimento já
 *     existente no produto."
 *   103:47 — "Passivo funciona igual (buscar + adicionar passivo)."
 *
 * Medido no código anterior (`git show HEAD:…vender-bem-material-dialog.tsx`):
 * o kind Passivo não tinha via de criação nenhuma (o `SearchCreateField` ia
 * sem `onCreate`, placeholder "Buscar passivo…"), e o kind Investimento tinha
 * exatamente o formulário reduzido que 103:37 proíbe —
 * `createInvestment.mutate({ name, entity: 'PF', accumulatedValue: 0 })`,
 * chutando entidade e saldo sem perguntar. E o rodapé dizia "Adicionar" onde
 * 103:46 diz "Direcionar".
 *
 * `fireEvent` em vez de `userEvent` pelo motivo já documentado no arquivo
 * irmão `vender-bem-material-dialog.test.tsx`: o `user-event` trava neste
 * ambiente depois que um Popover do Radix aparece.
 */

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

function openAllocationForm() {
  renderDialog()
  fireEvent.click(screen.getByRole('button', { name: '+ Adicionar Direcionamento' }))
}

describe('Vender Bem Material — criar o destino do Direcionamento (Figma 103:21)', () => {
  beforeEach(() => {
    // Re-stubado a cada teste: o `afterEach` abaixo desfaz TODOS os globais,
    // e o indicador do RadioGroup do Radix lê `ResizeObserver` já no primeiro
    // layout effect — sem isto o segundo teste morre em
    // "ResizeObserver is not defined".
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
      vi.fn(() => jsonResponse({ data: [] })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // 20 s por teste, como o arquivo irmão: cada `it` monta o modal inteiro
  // (Radix Dialog + Popover) sob jsdom, e o default de 5 s estoura quando a
  // suíte roda em paralelo.
  it('Figma 103:47 — Passivo funciona igual: buscar + "+ Adicionar" que abre o cadastro completo', async () => {
    openAllocationForm()
    fireEvent.click(screen.getByRole('radio', { name: 'Passivo' }))

    // Figma 103:34 / 103:47: o campo convida a ver a lista inteira.
    expect(
      await screen.findByPlaceholderText('Clique para ver a lista de passivos…'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar' }))

    // Figma 40:2 / seção 90:7 "Adicionar passivo": o cadastro completo, os
    // mesmos campos da tela Passivos.
    expect(screen.getByLabelText(/^Credor \/ Instituição/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Valor original da dívida/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Número de parcelas/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Taxa de juros \(a\.m\.\)/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Data de início/)).toBeInTheDocument()
  }, 20_000)

  it('Figma 103:37 — criar destino abre o cadastro completo, não um formulário reduzido', async () => {
    openAllocationForm()

    // O campo de destino é só busca: digitar um nome inédito NÃO oferece
    // mais um "+ Criar investimento" que inventaria entidade e saldo.
    const destino = await screen.findByPlaceholderText('Clique para ver a lista de investimentos…')
    fireEvent.focus(destino)
    fireEvent.change(destino, { target: { value: 'Tesouro Inédito' } })
    expect(screen.queryByRole('button', { name: /^\+ Criar investimento/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar' }))

    // Figma 333:110: Nome, Entidade e Valor inicial acumulado — os três
    // campos que o cadastro reduzido chutava.
    expect(screen.getByLabelText(/^Valor inicial acumulado/)).toBeInTheDocument()
    expect(screen.getAllByRole('radio', { name: 'PJ' }).length).toBeGreaterThan(0)
  }, 20_000)

  it('Figma 103:46 — o rodapé do sub-formulário conclui em "Direcionar", não "Adicionar"', () => {
    openAllocationForm()

    expect(screen.getByRole('button', { name: 'Direcionar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Adicionar' })).not.toBeInTheDocument()
  }, 20_000)
})
