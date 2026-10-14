import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PassivosScreen } from './passivos'

/**
 * Figma `40:2` (docs/figma/frames/40-2__desktop-passivos.xml): o card
 * "Adicionar passivo" tem 4 linhas, cada uma um nó próprio —
 * `90:8` Nome / Credor / Instituição / Entidade (linhas 63-87),
 * `90:24` Valor original da dívida / Valor da parcela / Número de parcelas
 * (linhas 88-107), `90:37` Parcelas já pagas / Taxa de juros (a.m.) / Data de
 * início (linhas 108-131), `90:50` Classificação (sugerida) sozinha, em linha
 * própria, por último (linhas 132-144). A implementação misturava Entidade
 * com Classificação numa linha, e trocava Número de parcelas por Taxa de
 * juros na 3ª linha — nenhuma das duas troca existe no Wireframe.
 */
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

function renderWithQueryClient(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('Passivos — ordem dos campos de "Adicionar passivo" (Figma 40:2, nós 90:8/90:24/90:37/90:50)', () => {
  it('segue a ordem das 4 linhas do Wireframe, com Classificação por último', () => {
    renderWithQueryClient(<PassivosScreen />)

    const heading = screen.getByRole('heading', { name: 'Adicionar passivo' })
    const card = heading.closest('div')?.parentElement as HTMLElement
    const labels = Array.from(card.querySelectorAll('label')).map((label) =>
      label.textContent?.replace(' *', ''),
    )

    expect(labels).toEqual([
      'Nome',
      'Credor / Instituição',
      'Entidade',
      'Valor original da dívida',
      'Valor da parcela',
      'Número de parcelas',
      'Parcelas já pagas',
      'Taxa de juros (a.m.)',
      'Data de início',
      'Classificação (sugerida)',
    ])
  })
})

/**
 * A lista "Passivos cadastrados" NÃO devolve para a pessoa o "Valor da parcela"
 * que ela declarou no formulário.
 *
 * Fonte medida, não deduzida — o mesmo passivo, nos dois lugares em que o design
 * o desenha listado:
 *
 * WIREFRAME — `40:2` "Desktop — Passivos"
 * (docs/figma/frames/40-2__desktop-passivos.xml). A linha `90:61` tem quatro
 * blocos: nome + credor (`90:63`/`90:64`), "Saldo devedor" R$ 178.400,00
 * (`90:66`/`90:67`), "Parcelas" 12/360 (`90:69`/`90:70`) e os botões
 * "Descartar" (`90:73`) e "Analisar" (`336:3`).
 *
 * MOCKUP — `933:1416` "Desktop — Passivos (claro)", linha `934:66`: os mesmos
 * quatro blocos, com "SALDO DEVEDOR" (`934:71`/`934:72`) e "PARCELAS"
 * (`934:74`/`934:75`).
 *
 * Em nenhum dos dois aparece o "Valor da parcela" — que existe só como campo do
 * formulário (`90:30` "Valor da parcela *"), e também não aparece no card
 * "Informações da Dívida" do Detalhe do Passivo (`91:2`, quatro itens: Valor
 * original `91:47`, Saldo devedor atual `91:50`, Taxa `91:53`, Parcelas
 * `91:56`). A implementação imprimia esse valor numa coluna "Parcela", que
 * nenhum frame desenha — e era ela que fazia parecer existir uma divergência
 * "declarado × calculado" para mostrar à pessoa (docs/PERGUNTAS-EM-ABERTO.md P3).
 */
describe('Passivos — a lista não exibe o "Valor da parcela" declarado (Figma 40:2 nó 90:61 · Mockup 933:1416 nó 934:66)', () => {
  function renderWithLiability() {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
        mutations: { retry: false },
      },
    })
    client.setQueryData(['liabilities'], {
      data: [
        {
          id: 'liab-1',
          name: 'Financiamento apartamento',
          creditor: 'Caixa Econômica',
          entity: 'PF',
          classification: 'NonCurrent',
          originalAmount: 32_000_000,
          installmentAmount: 152_000,
          installmentCount: 360,
          installmentsAlreadyPaid: 12,
          monthlyInterestRate: 0.0085,
          startDate: '2025-08-15',
          // O número que os dois frames desenham na linha (`90:67` e `934:72`).
          outstandingBalance: 17_840_000,
        },
      ],
    })
    return render(<QueryClientProvider client={client}>{<PassivosScreen />}</QueryClientProvider>)
  }

  it('não tem coluna "Parcela" nem imprime o valor declarado', () => {
    renderWithLiability()

    expect(screen.getByText('Financiamento apartamento')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Parcela' })).toBeNull()
    expect(screen.queryByText('R$ 1.520,00')).toBeNull()
  })

  /**
   * Decisão de produto de 2026-09-07: a coluna de dinheiro da lista passa a ser
   * "Saldo devedor", não "Valor original" — é o que os dois frames desenham
   * (Wireframe `40:2` nó `90:66`/`90:67`; Mockup `933:1416` nó `934:71`/`934:72`,
   * "R$ 178.400,00"). Exigiu `outstandingBalance` no contrato da lista, servido
   * por `src/app/api/v1/liabilities/_serialize.ts`.
   */
  it('a coluna de dinheiro é "Saldo devedor" e imprime o saldo, não o valor original', () => {
    renderWithLiability()

    expect(screen.getByRole('columnheader', { name: 'Saldo devedor' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Valor original' })).toBeNull()
    expect(screen.getByText('R$ 178.400,00')).toBeInTheDocument()
    expect(screen.queryByText('R$ 320.000,00')).toBeNull()
  })
})
