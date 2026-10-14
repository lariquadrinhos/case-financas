import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NovoLancamentoScreen } from './novo-lancamento-screen'

/**
 * Novo Lançamento é um DIÁLOGO sobre a tela atual, não uma tela cheia própria.
 *
 * O fato, medido: no Mockup o frame `872:592` "Desktop — Novo Lançamento (aba
 * Despesa) (claro)" é composto por `872:593` "Backdrop (Início)" + `872:826`
 * "Scrim" + `872:1305` "Modal — Novo Lançamento" (480×1144, x=616). O título
 * `872:1306` "Novo Lançamento" está em x=24 y=24 DENTRO de `872:1305`, e as
 * abas `872:1307` começam em y=60 — 16px abaixo dele. O Wireframe desenha o
 * mesmo: scrim `262:1120` + `6:29` "Modal — Novo Lançamento" (480 x 1134), com o
 * título `6:31` dentro do contêiner.
 *
 * INVERSÃO VERIFICADA: antes desta correção a tela era um `<h1
 * text-style-heading-xl>` IRMÃO de um `<Card max-w-[--width-dialog-wide]>`
 * (720px) — sem scrim, sem contêiner de diálogo, título fora do card e 240px
 * mais largo que o frame. Os três testes abaixo ficam vermelhos nessa versão
 * (`Unable to find role="dialog"`).
 */

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}))

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client')
  return {
    ...actual,
    apiGet: vi.fn(async () => ({ items: [] })),
    apiPost: vi.fn(async () => ({})),
    apiPatch: vi.fn(async () => ({})),
  }
})

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <NovoLancamentoScreen />
    </QueryClientProvider>,
  )
}

describe('Novo Lançamento (frames 872:1305 / 6:29) — é um diálogo, não uma tela cheia', () => {
  it('renderiza um diálogo (scrim + contêiner), como files_design/07 regra 10 exige', () => {
    renderScreen()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('tem o título "Novo Lançamento" DENTRO do contêiner do diálogo (`872:1306`, x=24 y=24)', () => {
    renderScreen()

    const dialog = screen.getByRole('dialog')
    const title = screen.getByRole('heading', { name: 'Novo Lançamento' })

    expect(dialog).toContainElement(title)
    // Um só título na composição — o frame desenha exatamente um `872:1306`.
    expect(screen.getAllByRole('heading', { name: 'Novo Lançamento' })).toHaveLength(1)
  })

  it('põe o título ACIMA das abas (`872:1307` em y=60, 16 abaixo do título)', () => {
    renderScreen()

    const title = screen.getByRole('heading', { name: 'Novo Lançamento' })
    const tabs = screen.getByRole('tablist')

    expect(title.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('usa a largura do frame (`--width-dialog-narrow`), não `--width-dialog-wide`', () => {
    renderScreen()

    const dialog = screen.getByRole('dialog')

    expect(dialog.className).toContain('--width-dialog-narrow')
    expect(dialog.className).not.toContain('--width-dialog-wide')
  })
})

/**
 * ADR-0018 (produto, 2026-09-23): a Conta de origem (PJ) passa a ser opcional —
 * o dinheiro pode cair direto na PF, sem sair de uma conta PJ cadastrada aqui.
 * A de destino (PF) continua obrigatória.
 */
describe('Novo Lançamento, aba Pró-labore — Conta de origem (PJ) opcional (ADR-0018)', () => {
  async function openProLaboreTab() {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('tab', { name: 'Pró-labore e Distribuição' }))
    return user
  }

  it('o rótulo da origem não leva o asterisco de obrigatório; o do destino leva', async () => {
    await openProLaboreTab()

    expect(screen.getByText('Conta de origem (PJ)').closest('label')?.textContent).not.toContain(
      '*',
    )
    expect(screen.getByText('Conta de destino (PF)').closest('label')?.textContent).toContain('*')
  })

  it('a origem tem o (i) explicando quando deixar em branco', async () => {
    await openProLaboreTab()

    expect(screen.getByRole('button', { name: 'Ajuda sobre Conta de origem' })).toBeInTheDocument()
  })

  it('salvar sem origem não acusa erro na origem, só no destino que falta', async () => {
    const user = await openProLaboreTab()
    await user.click(screen.getByRole('button', { name: 'Salvar Lançamento' }))

    expect(screen.queryByText('Selecione a conta de origem.')).not.toBeInTheDocument()
    expect(screen.getByText('Selecione a conta de destino.')).toBeInTheDocument()
  })
})

// Relato de 2026-09-23: com o título "Novo Lançamento" também na edição, a
// pessoa leu a tela como criação de um segundo lançamento e fechou sem salvar.
describe('Novo Lançamento em modo de edição', () => {
  it('o título diz "Editar Lançamento"', async () => {
    const navigation = await import('next/navigation')
    vi.spyOn(navigation, 'useSearchParams').mockReturnValue(
      new URLSearchParams('from=historico&entryId=entry-1') as never,
    )
    renderScreen()

    expect(screen.getByRole('heading', { name: 'Editar Lançamento' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Novo Lançamento' })).not.toBeInTheDocument()
  })
})

// Pedido de produto, 2026-09-23: sem Status, todo pró-labore nascia Pago — um
// pró-labore a receber em outubro não tinha como ser Previsto.
describe('Novo Lançamento, aba Pró-labore — Status', () => {
  // O teste de modo de edição acima troca `useSearchParams`; este é criação.
  beforeEach(() => vi.restoreAllMocks())

  it('tem o Status Previsto/Pago, com Previsto como padrão (2026-10-01)', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('tab', { name: 'Pró-labore e Distribuição' }))

    // "Pago"/"Previsto" só existem no Status desta aba (o Sub-tipo é
    // Pró-labore/Distribuição de lucro).
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Previsto' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Pago' })).not.toBeChecked()
  })
})

// Pedido do dono, 2026-10-01: "coloca o previsto como default". Numa conta
// vinculada ao Open Finance o Pago à mão é recusado (ADR-0020 §3): o banco é
// quem diz que foi pago, e o Previsto é o que a pessoa ainda lança.
describe('Novo Lançamento — Status nasce Previsto (2026-10-01)', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('Despesa: Previsto marcado, Pago não', () => {
    renderScreen()
    expect(screen.getByRole('radio', { name: 'Previsto' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Pago' })).not.toBeChecked()
  })

  it('Receita: Previsto marcado, Recebido não', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('tab', { name: 'Receita' }))
    expect(screen.getByRole('radio', { name: 'Previsto' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Recebido' })).not.toBeChecked()
  })
})

describe('Novo Lançamento — Descrição (2026-09-29)', () => {
  it('tem o campo "Descrição", opcional, fora das abas (vale para qualquer tipo)', async () => {
    const user = userEvent.setup()
    renderScreen()
    const campo = screen.getByRole('textbox', { name: /Descrição/ })
    expect(campo).not.toBeRequired()
    expect(screen.getByText('Descrição').closest('label')?.textContent).not.toContain('*')
    await user.click(screen.getByRole('tab', { name: 'Pró-labore e Distribuição' }))
    expect(screen.getByRole('textbox', { name: /Descrição/ })).toBeInTheDocument()
  })
})

describe('Novo Lançamento — Descrição no topo (2026-09-29)', () => {
  it('é o PRIMEIRO campo, logo abaixo das abas: vem antes do Valor, como um título', () => {
    renderScreen()
    const descricao = screen.getByRole('textbox', { name: /Descrição/ })
    const tabs = screen.getByRole('tablist')
    const primeiroCampoDaAba = screen.getAllByRole('textbox').find((el) => el !== descricao)!
    expect(tabs.compareDocumentPosition(descricao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(
      descricao.compareDocumentPosition(primeiroCampoDaAba) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

describe('Novo Lançamento — "Cartão de crédito" e "Contabilizar em" (ADR-0021)', () => {
  it('ADR-0021 — a Despesa tem os dois campos logo depois da Data de pagamento, nos padrões', () => {
    renderScreen()
    const cartao = screen.getByRole('switch', { name: 'Cartão de crédito' })
    expect(cartao).not.toBeChecked()
    // Seletor de mês (dono, 2026-10-06), aberto no mês do pagamento — que, num
    // lançamento novo, é o mês atual.
    const contabilizar = screen.getByLabelText(/Contabilizar em/) as HTMLInputElement
    expect(contabilizar.type).toBe('month')
    const hoje = new Date()
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
    expect(contabilizar.value).toBe(mesAtual)

    const data = screen.getByLabelText(/Data de pagamento/)
    const ordem = (a: Element, b: Element) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
    expect(ordem(data, cartao)).toBeTruthy()
    expect(ordem(cartao, contabilizar)).toBeTruthy()
    expect(ordem(contabilizar, screen.getByRole('radio', { name: 'Previsto' }))).toBeTruthy()
  })

  it('dono 2026-10-09 — a Receita tem "Cartão de crédito" (um estorno pode ser no cartão), mas não "Contabilizar em"', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('tab', { name: 'Receita' }))
    expect(screen.getByRole('switch', { name: 'Cartão de crédito' })).not.toBeChecked()
    expect(screen.queryByLabelText(/Contabilizar em/)).toBeNull()
  })
})

describe('Novo Lançamento — editar um gasto de Consumo Livre (dono, 2026-10-06)', () => {
  it('dono 2026-10-06 — abre o formulário, em vez de mandar editar pela Home', async () => {
    const navigation = await import('next/navigation')
    vi.spyOn(navigation, 'useSearchParams').mockReturnValue(
      new URLSearchParams('from=dre&entryId=gasto-1') as never,
    )
    const client = await import('@/lib/api-client')
    vi.mocked(client.apiGet).mockImplementation((async (path: string) => {
      if (path === '/entries/gasto-1') {
        return {
          id: 'gasto-1',
          kind: 'Expense',
          amount: 4_500,
          date: '2026-10-04',
          status: 'Paid',
          recurrenceId: null,
          entity: 'PF',
          categoryId: 'consumo-livre',
          classification: 'Current',
          bankAccountId: 'conta-1',
          description: 'Compra sintética',
        }
      }
      if (path === '/categories') {
        return {
          data: [
            {
              id: 'consumo-livre',
              name: 'Consumo Livre',
              isSystem: true,
              archived: false,
              blockId: 'personal-expenses',
            },
          ],
        }
      }
      return { data: [] }
    }) as never)
    renderScreen()
    expect(await screen.findByLabelText(/Data de pagamento/)).toHaveValue('2026-10-04')
    expect(screen.queryByText(/editado a partir do histórico do widget/)).toBeNull()
  })
})

describe('Novo Lançamento — origem no banco na edição (dono, 2026-10-09)', () => {
  async function editar(linkedToBank: boolean) {
    const navigation = await import('next/navigation')
    vi.spyOn(navigation, 'useSearchParams').mockReturnValue(
      new URLSearchParams('from=historico&entryId=dep-1') as never,
    )
    const client = await import('@/lib/api-client')
    vi.mocked(client.apiGet).mockImplementation((async (path: string) => {
      if (path === '/entries/dep-1') {
        return {
          id: 'dep-1',
          kind: 'Revenue',
          amount: 100_000,
          date: '2026-10-01',
          status: 'Planned',
          recurrenceId: null,
          entity: 'PF',
          categoryId: 'outras',
          classification: 'Current',
          bankAccountId: 'conta-1',
          ...(linkedToBank ? { linkedToBank: true } : {}),
        }
      }
      return { data: [] }
    }) as never)
    renderScreen()
    await screen.findByLabelText(/Data do recebimento/)
  }

  it('dono 2026-10-09 — feito à mão: oferece "Vincular ao banco"', async () => {
    await editar(false)
    expect(await screen.findByRole('button', { name: 'Vincular ao banco' })).toBeInTheDocument()
  })

  it('dono 2026-10-09 — já ligado: diz que tem origem no banco, sem o botão', async () => {
    await editar(true)
    expect(await screen.findByText('Vinculado a uma transação do banco.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vincular ao banco' })).toBeNull()
  })
})
