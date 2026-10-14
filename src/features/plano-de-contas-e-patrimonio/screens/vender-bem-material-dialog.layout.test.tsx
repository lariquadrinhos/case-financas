import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { VenderBemMaterialDialog } from './vender-bem-material-dialog'
import type { TangibleAsset } from '../types'

/**
 * Geometria dos dois campos de entrada do modal "Vender Bem Material".
 *
 * O frame desenha UMA coluna, os dois campos empilhados e cada um na largura
 * inteira do conteúdo do diálogo — nas DUAS páginas do arquivo:
 *
 * - Wireframe `99:2` → diálogo `99:39` (460 de largura, padding 28):
 *   `99:42` "Valor de venda *" em x=28 y=97 **w=404**, e `99:46`
 *   "Data da venda *" em x=28 y=174 **w=404**. 404 = 460 − 28×2, a largura
 *   inteira. (docs/figma/frames/99-2__desktop-vender-bem-material-modal.xml)
 * - Mockup `991:2204` "Diálogo" (460 de largura, padding 24): as duas
 *   instâncias "Campo" `991:2208` (x=24 y=92 **w=412**) e `991:2212`
 *   (x=24 y=172 **w=412**). 412 = 460 − 24×2. O intervalo vertical
 *   172 − (92+64) = **16** é exatamente o `gap-16` do `DialogBody`.
 *
 * A implementação anterior punha os dois num `grid grid-cols-2 gap-16` — lado
 * a lado, ~198 de largura cada contra os 412 desenhados. Nenhum dos 130 frames
 * do Wireframe, nem o Mockup, desenha esse par em duas colunas.
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

/** Menor ancestral que contém os dois elementos. */
function commonAncestor(a: HTMLElement, b: HTMLElement): HTMLElement {
  let node: HTMLElement | null = a
  while (node && !node.contains(b)) node = node.parentElement
  if (!node) throw new Error('os dois campos não compartilham ancestral')
  return node
}

describe('Vender Bem Material — os dois campos (Figma 99:42/99:46 · Mockup 991:2208/991:2212)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ data: [] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        ),
      ),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('Figma 99:39 / Mockup 991:2204 — "Valor de venda" e "Data da venda" ficam empilhados numa coluna só, não lado a lado', () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    render(
      <QueryClientProvider client={client}>
        <VenderBemMaterialDialog asset={asset} open onOpenChange={() => {}} />
      </QueryClientProvider>,
    )

    // `exact: false` porque `Field` anexa " *" ao label obrigatório.
    const valor = screen.getByLabelText('Valor de venda', { exact: false })
    const data = screen.getByLabelText('Data da venda', { exact: false })

    const shared = commonAncestor(valor, data)

    // Empilhados: o container comum é a coluna do corpo do diálogo…
    expect(shared.className).toContain('flex-col')
    // …e não uma grade de duas colunas.
    expect(shared.className).not.toContain('grid-cols-2')
    // E é o próprio corpo do diálogo — logo cada campo é irmão do bloco de
    // Ganho/Perda e herda a largura inteira (404/412 nos frames), em vez de
    // dividir uma linha entre si.
    expect(shared).toHaveTextContent('Ganho/Perda (calculado)')
  })

  /**
   * O "Resumo" fecha o bloco "Direcionar", e isso está desenhado: dentro de
   * `991:2220` a ordem é rótulo `991:2221` → linha "Alocação" `991:2222` →
   * "Divisor" com o "+ Adicionar" `991:2225` → "Resumo" `991:2229` (as duas
   * frases, `991:2230` e `991:2231`).
   *
   * O código punha o par "Direcionado/Restante" logo abaixo do rótulo, no
   * começo. Pela ADR-0015 quem decide a camada visual é a Mockup.
   */
  it('Figma 991:2229 — o resumo fecha o bloco "Direcionar", depois do "+ Adicionar"', () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    render(
      <QueryClientProvider client={client}>
        <VenderBemMaterialDialog asset={asset} open onOpenChange={() => {}} />
      </QueryClientProvider>,
    )

    const adicionar = screen.getByRole('button', { name: '+ Adicionar Direcionamento' })
    const direcionado = screen.getByText(/^Direcionado: /)

    expect(
      adicionar.compareDocumentPosition(direcionado) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
