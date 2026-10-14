import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AllocationEditor } from './allocation-editor'
import { cents } from '@/domain/core'

/**
 * Frame 103:21 "Estado — Adicionar Direcionamento (Investimento)" (página
 * Wireframe, docs/figma/frames/103-21__estado-adicionar-direcionamento-investimento.xml)
 * desenha este sub-formulário inteiro, e duas notas dele estavam contrariadas
 * aqui:
 *
 *   103:37 — "Abre o formulário completo de cadastro de investimento já
 *     existente no produto." (anotando o botão 103:35/103:36 "+ Adicionar",
 *     na linha 202:20: divisor à esquerda, botão à direita).
 *   103:47 — "Passivo funciona igual (buscar + adicionar passivo)."
 *
 * `AllocationEditor` é o que a Pendência ("Direcionar agora", Home) monta —
 * `src/app/(app)/inicio/_components/modals/direcionar-pendencia-modal.tsx`.
 * Medido no código anterior (`git show HEAD:…screens/allocation-editor.tsx`):
 * com Tipo = Passivo o Destino era um Radix `Select` (role combobox) sobre
 * `liabilityList`, sem caixa de texto — não dava pra filtrar digitando nem
 * pra criar; e com Tipo = Investimento o "+ Criar investimento" do dropdown
 * chamava `createInvestment.mutate({ name, entity: 'PF', accumulatedValue: 0 })`,
 * exatamente o formulário reduzido (entidade e saldo chutados) que 103:37
 * proíbe.
 *
 * `fireEvent` em vez de `userEvent` pelo motivo já documentado nos arquivos
 * irmãos: o `user-event` trava neste ambiente depois que um Popover do Radix
 * aparece.
 */

function jsonResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

const LIABILITIES = [
  {
    id: 'liab-sintetico-1',
    name: 'Financiamento Sintético',
    creditor: 'Credor Sintético',
    entity: 'PF',
    classification: 'NonCurrent',
    originalAmount: 500000,
    installmentAmount: 50000,
    installmentCount: 10,
    installmentsAlreadyPaid: 0,
    monthlyInterestRate: 0.01,
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
    monthlyInterestRate: 0.02,
    startDate: '2026-01-01',
  },
]

function renderEditor() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <AllocationEditor
        allocations={[]}
        remaining={cents(10_000_00)}
        onAdd={() => {}}
        onEdit={() => {}}
        onRemove={() => {}}
      />
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: '+ Adicionar Direcionamento' }))
}

describe('AllocationEditor — Adicionar Direcionamento (Figma 103:21)', () => {
  beforeEach(() => {
    // Re-stubado a cada teste: o `afterEach` desfaz TODOS os globais, e o
    // indicador do RadioGroup do Radix lê `ResizeObserver` já no primeiro
    // layout effect.
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
        if (url.includes('/api/v1/liabilities')) return jsonResponse({ data: LIABILITIES })
        return jsonResponse({ data: [] })
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('Figma 103:47 — Passivo busca por digitação, como Investimento, e não é um <select> só de existentes', async () => {
    renderEditor()
    fireEvent.click(screen.getByRole('radio', { name: 'Passivo' }))

    // Figma 103:34 ("Clique para ver a lista de investimentos…"), aplicado a
    // Passivo pela igualdade que 103:47 declara.
    const destino = await screen.findByPlaceholderText('Clique para ver a lista de passivos…')
    expect(screen.queryByRole('combobox', { name: 'Destino' })).not.toBeInTheDocument()

    // files_design/03 "Objeto Direcionamento": "lista completa ao clicar,
    // filtra ao digitar".
    fireEvent.focus(destino)
    expect(await screen.findByRole('button', { name: 'Financiamento Sintético' })).toBeVisible()

    fireEvent.change(destino, { target: { value: 'Cartão' } })
    expect(await screen.findByRole('button', { name: 'Cartão Sintético' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Financiamento Sintético' }),
    ).not.toBeInTheDocument()
  })

  it('Figma 103:47 + 103:37 — "+ Adicionar" abre o cadastro COMPLETO de passivo, não um reduzido', async () => {
    renderEditor()
    fireEvent.click(screen.getByRole('radio', { name: 'Passivo' }))
    await screen.findByPlaceholderText('Clique para ver a lista de passivos…')

    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar' }))

    // Figma 40:2 / seção 90:7 "Adicionar passivo": os mesmos campos
    // obrigatórios da tela Passivos, via `LiabilityForm`.
    expect(screen.getByLabelText(/^Credor \/ Instituição/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Valor original da dívida/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Número de parcelas/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Taxa de juros \(a\.m\.\)/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Data de início/)).toBeInTheDocument()
  })

  it('Figma 103:37 — Investimento cria pelo cadastro completo, não pelo "+ Criar" que chutava entidade e saldo', async () => {
    renderEditor()

    const destino = await screen.findByPlaceholderText('Clique para ver a lista de investimentos…')
    fireEvent.focus(destino)
    fireEvent.change(destino, { target: { value: 'Tesouro Inédito' } })
    expect(screen.queryByRole('button', { name: /^\+ Criar investimento/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar' }))

    // Figma 333:110: Nome, Entidade e Valor inicial acumulado — os três
    // campos que o cadastro reduzido decidia sozinho.
    expect(screen.getByLabelText(/^Valor inicial acumulado/)).toBeInTheDocument()
    expect(screen.getAllByRole('radio', { name: 'PJ' }).length).toBeGreaterThan(0)
  })

  it('Figma 103:46 — o rodapé do sub-formulário conclui em "Direcionar"', () => {
    renderEditor()

    expect(screen.getByRole('button', { name: 'Direcionar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Adicionar' })).not.toBeInTheDocument()
  })
})

/**
 * A LISTA (frame 99:2 → 103:8) é a outra metade deste editor, e ela também
 * estava fora do desenho: o frame de ações 103:12 traz "Editar" (103:13, x=0)
 * E "Remover" (103:15, x=62) em cada linha, sem variante por Tipo — e esta
 * lista só tinha "Remover", para nenhum dos três. files_design/03 "Objeto
 * Direcionamento" e files_design/01 §11 escrevem a mesma regra em palavras.
 */
describe('AllocationEditor — ações da lista (Figma 99:2, nós 103:13/103:15)', () => {
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
      vi.fn(() => jsonResponse({ data: [] })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    ['Investment' as const, 'Investimento: Reserva Sintética'],
    ['Liability' as const, 'Passivo: Financiamento Sintético'],
    ['Revenue' as const, 'Receita: Categoria Sintética'],
  ])('cada Direcionamento (%s) tem Editar e Remover', (kind, label) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    render(
      <QueryClientProvider client={client}>
        <AllocationEditor
          allocations={[
            {
              id: 'aloc-sintetica-1',
              kind,
              target: kind === 'Revenue' ? null : 'destino-sintetico-1',
              targetLabel: label.split(': ')[1] ?? null,
              amount: cents(5_000_00),
              label,
              revenue:
                kind === 'Revenue'
                  ? {
                      date: '2026-01-10',
                      status: 'Paid',
                      entity: 'PF',
                      categoryId: 'cat-sintetica-1',
                      bankAccountId: 'conta-sintetica-1',
                    }
                  : null,
            },
          ]}
          remaining={cents(5_000_00)}
          onAdd={() => {}}
          onEdit={() => {}}
          onRemove={() => {}}
        />
      </QueryClientProvider>,
    )

    const row = screen.getByText(label).closest('li') as HTMLElement
    expect(within(row).getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Remover' })).toBeInTheDocument()
  })
})
