import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { VenderBemMaterialDialog } from './vender-bem-material-dialog'
import type { TangibleAsset } from '../types'

/**
 * Figma 99:2 "Desktop — Vender Bem Material (modal)", página Wireframe
 * (docs/figma/frames/99-2__desktop-vender-bem-material-modal.xml): a linha do
 * Direcionamento (103:8) tem o frame de ações 103:12 com EXATAMENTE dois
 * botões — 103:13 "Editar" (x=0) e 103:15 "Remover" (x=62) — e o arquivo não
 * desenha nenhuma segunda variante dessa linha, por Tipo ou por qualquer outra
 * coisa. A nota 103:47 do frame 103:21 diz que Passivo e Receita são o "mesmo
 * fluxo", e a nota 152:15 do frame 34:2 repete. files_design/03 "Objeto
 * Direcionamento" e files_design/01 §11 escrevem a mesma regra em palavras.
 *
 * A implementação escondia o "Editar" quando `allocation.kind === 'Revenue'`,
 * porque disparava o `POST /entries` já no "Direcionar" (103:46). O desenho diz
 * o contrário: a única gravação do modal é o rodapé 99:67 "Confirmar Venda",
 * logo a lista é rascunho até ali — nos três Tipos. Os dois testes abaixo
 * cobrem as duas metades disso.
 *
 * `fireEvent` em vez de `userEvent` pelo mesmo motivo documentado em
 * `vender-bem-material-dialog.test.tsx`: `userEvent.click` trava sob jsdom
 * depois que um Popover do Radix aparece na página.
 */

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)
// O Radix Select usa a API de pointer capture e `scrollIntoView`, que o jsdom
// não implementa — sem estes stubs o dropdown "Conta" nem abre.
Element.prototype.scrollIntoView = () => {}
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}

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

/** Adiciona um Direcionamento de Tipo Receita e devolve a `<li>` da lista. */
async function addRevenueAllocation(): Promise<HTMLElement> {
  fireEvent.change(screen.getByLabelText('Valor de venda', { exact: false }), {
    target: { value: '100000' },
  })

  fireEvent.click(screen.getByRole('button', { name: '+ Adicionar Direcionamento' }))

  // Segmented control 103:24 → opção 103:30 "Receita".
  fireEvent.click(screen.getByRole('radio', { name: 'Receita' }))

  fireEvent.change(screen.getByLabelText(/^Valor \*$/), { target: { value: '50000' } })

  fireEvent.focus(screen.getByLabelText('Categoria', { exact: false }))
  fireEvent.click(await screen.findByRole('button', { name: 'Categoria Sintética' }))

  // Teclado, e não ponteiro: o jsdom não implementa PointerEvent com `button`,
  // então o `onPointerDown` do gatilho do Radix Select nunca abre a lista.
  // `/^Conta \*/` e não `'Conta'` frouxo: o modal tem DOIS campos que começam
  // com "Conta" — o da alocação de Receita e o "Conta do ganho/perda" que P33
  // acrescentou. A âncora no asterisco casa só com o primeiro.
  const contaTrigger = screen.getByLabelText(/^Conta \*/)
  fireEvent.keyDown(contaTrigger, { key: 'ArrowDown' })
  const option = await screen.findByRole('option', { name: 'Conta Sintética' })
  fireEvent.keyDown(option, { key: 'Enter' })

  // Figma 103:46: o botão que conclui o sub-formulário.
  fireEvent.click(screen.getByRole('button', { name: 'Direcionar' }))

  return (await screen.findByText('Receita: Categoria Sintética')).closest('li') as HTMLElement
}

// Estes dois testes levavam 18,7s e 18,3s até a P40 ser medida em 2026-09-09.
// A causa não era o Popover do Radix nem contenção de CPU: era a recursão
// mútua de `:modal` entre @floating-ui e nwsapi, cortada em vitest.setup.ts.
// Hoje: 203ms e 98ms, sem timeout próprio.
describe('Vender Bem Material — Direcionamento de Receita (Figma 99:2, nós 103:13/103:15)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/v1/categories')) {
          return jsonResponse({
            data: [
              {
                id: 'cat-sintetica-1',
                name: 'Categoria Sintética',
                kind: 'Revenue',
                entity: 'PF',
                archived: false,
              },
            ],
          })
        }
        if (url.includes('/api/v1/bank-accounts')) {
          return jsonResponse({
            data: [{ id: 'conta-sintetica-1', label: 'Conta Sintética', entity: 'PF' }],
          })
        }
        return jsonResponse({ data: [] })
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('Figma 99:2 → 103:12 — a linha de um Direcionamento de Receita tem Editar E Remover', async () => {
    renderDialog()
    const row = await addRevenueAllocation()

    expect(within(row).getByRole('button', { name: 'Remover' })).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Editar' })).toBeInTheDocument()
  })

  it('Figma 99:2 → 99:67 — nenhum POST /entries sai antes de "Confirmar Venda"', async () => {
    renderDialog()
    await addRevenueAllocation()

    const postsToEntries = () =>
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) =>
          String(call[0]).includes('/api/v1/entries') &&
          (call[1] as RequestInit | undefined)?.method === 'POST',
      )

    expect(postsToEntries()).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Venda' }))
    await screen.findByText('Receita: Categoria Sintética')
    await vi.waitFor(() => expect(postsToEntries()).toHaveLength(1))
  })
})
