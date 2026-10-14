import { describe, expect, it, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cents } from '@/domain/core'
import { DirecionarPendenciaModal } from './direcionar-pendencia-modal'

/**
 * files_design/03 "Pendente de Direcionamento": "Ação 'Direcionar agora' abre
 * a mesma escolha de conta que aparecia no modal de venda" — e
 * `directPendingAllocation` (src/domain/assets/pending-allocation-rules.ts)
 * exige que os direcionamentos somem EXATAMENTE o valor pendente, sem estado
 * parcial: não existe "resolver uma parte agora, o resto depois".
 *
 * O caminho de escolher e confirmar um destino de verdade já é coberto (com
 * `client.setQueryData`, sem rede) pela suíte de `VenderBemMaterialDialog`,
 * que usa a MESMA `AllocationEditor` — replicar aqui só duplicaria aquela
 * suíte. O que é específico deste modal, e o que este arquivo testa, é a
 * regra que só ele impõe: "Confirmar" trava até o Restante zerar.
 */
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

const mutate = vi.fn()
vi.mock('../../_lib/mutations', () => ({
  useDirectPendingAllocation: () => ({ mutate, isPending: false }),
}))

function renderModal() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  })
  client.setQueryData(['investments'], { data: [], meta: { total: 0 } })
  client.setQueryData(['liabilities'], { data: [], meta: { total: 0 } })
  client.setQueryData(['categories'], { data: [], meta: { total: 0 } })
  client.setQueryData(['bank-accounts'], { data: [], meta: { total: 0 } })

  return render(
    <QueryClientProvider client={client}>
      <DirecionarPendenciaModal
        selection={{
          id: 'pending-1',
          amount: cents(480000),
          description: 'Venda de Civic Teste 2020',
        }}
        open
        onOpenChange={() => {}}
      />
    </QueryClientProvider>,
  )
}

describe('Direcionar valor (files_design/03 "Pendente de Direcionamento")', () => {
  it('mantém "Confirmar" desabilitado sem nenhum direcionamento adicionado', () => {
    renderModal()

    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
  })

  // "Direcionar", e não "Adicionar": o rodapé do sub-formulário é o par
  // 103:43/103:45 do frame 103:21 ("Cancelar"/"Direcionar"), enquanto
  // "+ Adicionar" (103:35) é o botão que CRIA o destino, na linha 202:20.
  it('recusa "Direcionar" sem destino escolhido, sem fechar a Pendência por engano', () => {
    renderModal()

    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar Direcionamento' }))
    fireEvent.change(screen.getByLabelText('Valor a alocar'), {
      target: { value: 'R$ 4.800,00' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Direcionar' }))

    expect(screen.getByText('Selecione ou crie um investimento de destino.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
    expect(mutate).not.toHaveBeenCalled()
  })

  it('mostra a origem e o valor da pendência no cabeçalho, igual ao card', () => {
    renderModal()

    const dialog = screen.getByRole('dialog', { name: 'Direcionar valor' })
    expect(
      within(dialog).getByText('Venda de Civic Teste 2020 · R$ 4.800,00 aguardando direcionamento'),
    ).toBeInTheDocument()
  })

  /**
   * O resumo é EMPILHADO, e em duas frases — não uma linha só à direita do
   * rótulo. Medido no navegador em 2026-09-11 (clone com `white-space: nowrap`,
   * fora do fluxo, na tipografia real), com 392 de espaço útil aqui e 410 no
   * Vender Bem Material:
   *
   *   "Direcionar valor recebido"                              164
   *   "Direcionado: R$ 0,00 de R$ 0,00 · Restante: R$ 0,00"    316  → soma 480
   *   idem com valores realistas                                396  → soma 560
   *   idem no teto de 999 bilhões                               517  → soma 681
   *
   * Ou seja: a linha nunca coube, nem no estado vazio, e quebrava sempre —
   * um fragmento alinhado à direita, amassado contra o rótulo. Partida em duas
   * frases ela cabe: "Direcionado: … de …" mede 253 e "Restante: …" mede 134
   * com valores realistas (399 e 210 no teto).
   *
   * Duas frases e não uma porque é assim que o Figma já desenha este bloco no
   * diálogo irmão: o "Resumo" do `Desktop — Vender Bem Material` tem DOIS nós
   * de texto, `991:2230` e `991:2231`, um por frase.
   */
  it('empilha o resumo em duas frases, em vez de espremê-lo ao lado do rótulo', () => {
    renderModal()

    const dialog = screen.getByRole('dialog', { name: 'Direcionar valor' })
    const direcionado = within(dialog).getByText(/^Direcionado: /)
    const restante = within(dialog).getByText(/^Restante: /)

    expect(direcionado).not.toBe(restante)
    expect(direcionado.textContent).not.toContain('Restante')
  })

  /**
   * E o resumo fica no FIM do bloco, depois da lista de direcionamentos e do
   * "+ Adicionar" — a ordem que o Figma desenha no frame irmão
   * `Desktop — Vender Bem Material`: dentro do bloco "Direcionar" (`991:2220`)
   * vêm, nesta ordem, o rótulo `991:2221`, a linha "Alocação" `991:2222`, o
   * "Divisor" com o "+ Adicionar" `991:2225` e só então o "Resumo" `991:2229`.
   *
   * O código punha o resumo no começo, sob o rótulo. Pela ADR-0015 quem decide
   * a camada visual é a Mockup, e a ordem de leitura faz sentido: o total só
   * quer dizer alguma coisa depois de a pessoa ver o que já direcionou.
   */
  it('Figma 991:2229 — o resumo fecha o bloco, depois do "+ Adicionar"', () => {
    renderModal()

    const dialog = screen.getByRole('dialog', { name: 'Direcionar valor' })
    const adicionar = within(dialog).getByRole('button', {
      name: '+ Adicionar Direcionamento',
    })
    const direcionado = within(dialog).getByText(/^Direcionado: /)

    expect(
      adicionar.compareDocumentPosition(direcionado) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
