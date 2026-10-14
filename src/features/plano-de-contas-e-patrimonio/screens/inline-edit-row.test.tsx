import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BensMateriaisScreen } from './bens-materiais'
import { InvestimentosScreen } from './investimentos'
import { ContasBancariasScreen } from './contas-bancarias'
import { DEFAULT_BANK_ACCOUNT_COLOUR } from '@/lib/bank-account-colours'

/**
 * Wireframe `46:8` "Estado — Editar categoria (inline)"
 * (docs/figma/frames/46-8__estado-editar-categoria-inline.xml) é o único
 * estado de edição inline desenhado no arquivo inteiro, e é o padrão que as
 * três linhas de edição de Plano de Contas e Patrimônio herdam. Ele desenha
 * ② "Depois: edição inline" assim:
 *
 *   `46:25` linha 320×31 → `46:26` campo x=12, width=296 — a linha inteira
 *           menos os 12 de padding de cada lado; NÃO uma largura fixa.
 *   `46:28` x=20, y=92 → `46:29` "Cancelar" (x=0) e `46:31` "Salvar" (x=78),
 *           uma linha ABAIXO do campo, que termina em y=80.
 *
 * O código anterior (`git show HEAD:src/features/plano-de-contas-e-patrimonio/screens/bens-materiais.tsx`)
 * fazia o oposto nas duas pontas: `w-[var(--width-inline-name-edit)]` (200px
 * fixos, contra 458,5 desenhados no Mockup `925:1434`) e
 * `<div className="flex flex-wrap items-end gap-16 py-8">` com campos e
 * botões na MESMA linha, na ordem Salvar → Cancelar.
 */

function jsonResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

const TANGIBLE_ASSETS = [
  { id: 'asset-sintetico-1', name: 'Bem Sintético', entity: 'PF', recordedValue: 120000 },
]
const INVESTMENTS = [
  { id: 'inv-sintetico-1', name: 'Fundo Sintético', entity: 'PF', accumulatedValue: 350000 },
]
const BANK_ACCOUNTS = [
  {
    id: 'acc-sintetico-1',
    label: 'Conta Sintética',
    colour: DEFAULT_BANK_ACCOUNT_COLOUR,
    entity: 'PF',
    balance: 420000,
  },
]

function renderScreen(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

/** A célula da linha em edição — a que contém "Cancelar" e "Salvar". */
async function openInlineEditor(rowName: string) {
  const row = (await screen.findByText(rowName)).closest('tr') as HTMLElement
  fireEvent.click(within(row).getByRole('button', { name: 'Editar' }))
  const cancel = await screen.findByRole('button', { name: 'Cancelar' })
  return { cell: cancel.closest('td') as HTMLElement, cancel }
}

describe('Plano de Contas e Patrimônio — linha em edição inline (Wireframe 46:8)', () => {
  beforeEach(() => {
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
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/v1/tangible-assets')) return jsonResponse({ data: TANGIBLE_ASSETS })
        if (url.includes('/api/v1/investments')) return jsonResponse({ data: INVESTMENTS })
        if (url.includes('/api/v1/bank-accounts')) return jsonResponse({ data: BANK_ACCOUNTS })
        return jsonResponse({ data: [] })
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const cases = [
    { screen: <BensMateriaisScreen />, item: 'Bem Sintético', nameLabel: 'Nome *' },
    { screen: <InvestimentosScreen />, item: 'Fundo Sintético', nameLabel: 'Nome *' },
    { screen: <ContasBancariasScreen />, item: 'Conta Sintética', nameLabel: 'Nome da conta *' },
  ] as const

  it.each(cases)(
    'Figma 46:26 — o campo de nome preenche a linha, sem largura fixa (%#)',
    async ({ screen: ui, item, nameLabel }) => {
      renderScreen(ui)
      const { cell } = await openInlineEditor(item)

      const nameInput = within(cell).getByLabelText(nameLabel)
      const nameField = nameInput.parentElement as HTMLElement

      expect(nameField.className).not.toContain('--width-inline-name-edit')
      expect(nameField.className).toContain('flex-1')
    },
  )

  it.each(cases)(
    'Figma 46:28 — Cancelar e Salvar ficam numa linha abaixo dos campos, nessa ordem (%#)',
    async ({ screen: ui, item, nameLabel }) => {
      renderScreen(ui)
      const { cell, cancel } = await openInlineEditor(item)

      const save = within(cell).getByRole('button', { name: 'Salvar' })
      const buttonRow = cancel.parentElement as HTMLElement
      const nameInput = within(cell).getByLabelText(nameLabel)

      // `46:28` está fora de `46:25`: a fileira de botões não contém campo.
      expect(buttonRow.contains(nameInput)).toBe(false)
      // …e é uma linha ABAIXO, não uma coluna ao lado: o pai empilha.
      expect((buttonRow.parentElement as HTMLElement).className).toContain('flex-col')
      // `46:29` "Cancelar" em x=0, `46:31` "Salvar" em x=78.
      expect(cancel.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    },
  )
})
