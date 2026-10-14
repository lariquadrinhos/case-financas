import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { VenderBemMaterialDialog } from './vender-bem-material-dialog'
import type { TangibleAsset } from '../types'

/**
 * files_design/03 "Objeto Direcionamento": "Cada Direcionamento tem ações
 * Editar/Remover na lista do modal principal." files_design/01 §11 repete a
 * mesma frase ("lista dos direcionamentos já adicionados (Editar/Remover cada
 * um)"), e o Figma (99-2__desktop-vender-bem-material-modal.xml, nodes
 * 103:13 "Editar" e 103:15 "Remover") desenha os dois botões lado a lado por
 * item. A implementação só tinha "Remover".
 *
 * `fireEvent` em vez de `userEvent` em TODA a interação: `userEvent.click`
 * trava indefinidamente neste ambiente assim que um `Popover` do Radix
 * (usado pelo `SearchCreateField`) já apareceu na página — a simulação de
 * ponteiro completa do `user-event` depende de `elementFromPoint`/pointer
 * capture, que o jsdom não implementa direito, e fica presa tentando resolver
 * isso mesmo em botões comuns depois. `fireEvent` dispara o evento do DOM
 * direto, sem essa simulação, e é o que os outros testes de tela deste
 * projeto também fazem.
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

describe(
  'Vender Bem Material — ações do Direcionamento na lista ' +
    '(files_design/03 "Objeto Direcionamento" / files_design/01 §11)',
  () => {
    beforeEach(() => {
      // Só `/investments` importa para este cenário (Direcionamento de
      // Investimento); as demais listas (passivos, categorias, contas)
      // voltam vazias — o suficiente para o formulário renderizar sem travar
      // em `undefined`.
      vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL) => {
          const url = String(input)
          if (url.includes('/api/v1/investments')) {
            return jsonResponse({
              data: [
                {
                  id: 'inv-sintetico-1',
                  name: 'Reserva Sintética',
                  entity: 'PF',
                  accumulatedValue: 0,
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

    // Timeout maior que o padrão de 5s: o Popover do SearchCreateField, neste
    // ambiente jsdom, leva de 8 a 17s para resolver (mesmo motivo do comentário
    // sobre `fireEvent` vs `userEvent` no topo do arquivo) — não é o teste que
    // está lento, é a simulação de ponteiro do Radix sob jsdom.
    // Este teste levava 11,5s até a P40 ser medida em 2026-09-09: não era
    // contenção de CPU, como este comentário afirmava, era a recursão de
    // `:modal` entre @floating-ui e nwsapi (ver vitest.setup.ts). Hoje: 151ms.
    it('um Direcionamento de Investimento já adicionado mostra Editar e Remover, não só Remover', async () => {
      renderDialog()

      // `getByLabelText` casa com o texto INTEIRO do label, e `Field` anexa
      // " *" como span irmão em campo obrigatório — por isso `exact: false`
      // (mesmo motivo de `bens-materiais.test.tsx` remover ' *' do texto do
      // label antes de comparar).
      fireEvent.change(screen.getByLabelText('Valor de venda', { exact: false }), {
        target: { value: '100000' },
      })

      fireEvent.click(screen.getByRole('button', { name: '+ Adicionar Direcionamento' }))

      fireEvent.focus(screen.getByLabelText('Destino', { exact: false }))
      fireEvent.click(await screen.findByRole('button', { name: 'Reserva Sintética' }))

      fireEvent.change(screen.getByLabelText('Valor a alocar', { exact: false }), {
        target: { value: '50000' },
      })

      // Figma 103:46: o botão que conclui o sub-formulário chama
      // "Direcionar" — "Adicionar" é o "+ Adicionar" (103:36) que abre o
      // cadastro do destino, uma linha acima.
      fireEvent.click(screen.getByRole('button', { name: 'Direcionar' }))

      const row = (await screen.findByText('Investimento: Reserva Sintética')).closest(
        'li',
      ) as HTMLElement

      expect(within(row).getByRole('button', { name: 'Remover' })).toBeInTheDocument()
      expect(within(row).getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    })
  },
)
