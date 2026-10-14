import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fetchIncomeStatement } from '@/lib/reports-client'
import DrePage from './page'
import { assertReadingOrder } from '@/lib/testing/reading-order'

/**
 * Ação de linha (pedido do dono, 2026-10-01: "Marcar pago, Descartar e Editar
 * não parecem um botão"). Substitui a regra do files_design/07, "No DRE",
 * "'Editar' virou ação em texto azul": a ação em linha é o Botão Secundário
 * (contorno `border-line-control`) no tamanho `compact`, em todo o app.
 */
const { fixture } = vi.hoisted(() => ({
  fixture: {
    month: '2026-08',
    view: 'Consolidated',
    statusFilter: 'Paid',
    lines: [],
    netProfit: 0,
    rows: [
      {
        source: { kind: 'Entry', entryId: 'entry-1' },
        name: 'Categoria sintética',
        entity: 'PF',
        blockId: 'bloco-1',
        blockName: 'Receita',
        status: 'Paid',
        amount: 1000,
      },
    ],
  },
}))

vi.mock('@/lib/reports-client', () => ({
  fetchIncomeStatement: vi.fn().mockResolvedValue(fixture),
}))

vi.mock('@/features/novo-lancamento/use-novo-lancamento', async (original) => ({
  ...(await original<typeof import('@/features/novo-lancamento/use-novo-lancamento')>()),
  useBankAccounts: () => ({
    data: {
      data: [
        { id: 'c-a', label: 'Banco Sintético A', colour: 'nubank', entity: 'PF', balance: 100_000 },
        { id: 'c-b', label: 'Banco Sintético B', colour: 'nubank', entity: 'PJ', balance: 50_000 },
      ],
    },
  }),
}))

vi.mock('@/features/open-finance/use-month-movement', () => ({
  useMonthMovement: () => ({
    status: 'success',
    data: { data: [{ bankAccountId: 'c-a', movement: 40_000 }] },
  }),
}))

vi.mock('@/lib/use-report-view', () => ({
  useReportView: () => ['Consolidated', vi.fn()],
}))

vi.mock('@/lib/today', () => ({
  todayMonth: () => '2026-08',
}))

beforeEach(() => {
  vi.mocked(fetchIncomeStatement).mockResolvedValue(
    fixture as unknown as Awaited<ReturnType<typeof fetchIncomeStatement>>,
  )
})

function renderDre() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <DrePage />
    </QueryClientProvider>,
  )
}

/**
 * Os grupos de "Lançamentos deste mês" começam fechados (dono, 2026-10-06);
 * os testes que leem as linhas abrem os dois antes.
 */
/** O "Exibir tudo" da cascata — "Lançamentos deste mês" tem o seu (2026-10-06). */
async function botaoDaCascata(nome: 'Exibir tudo' | 'Recolher tudo') {
  const botoes = await screen.findAllByRole('button', { name: nome })
  return botoes.find((b) => b.closest('[data-dre-cascade-card]')) as HTMLElement
}

async function abrirLancamentos() {
  const grupos = await screen
    .findAllByRole('button', { name: /\((\+|−)\) (Entradas|Saídas)/ }, { timeout: 1500 })
    .catch(() => [] as HTMLElement[])
  for (const grupo of grupos) {
    if (grupo.getAttribute('aria-expanded') === 'false') fireEvent.click(grupo)
  }
}

describe('DRE — ação de linha com cara de botão (2026-10-01)', () => {
  it('renderiza "Editar" na tabela de Lançamentos como botão compacto com contorno', async () => {
    renderDre()
    await abrirLancamentos()

    const editLink = await screen.findByRole('link', { name: 'Editar' })

    expect(editLink.className).toContain('border-line-control')
    expect(editLink.className).toContain('h-[var(--height-control)]')
  })

  /**
   * files_design/01 §8.1: a tabela "Lançamentos deste mês" mostra a etiqueta
   * PF/PJ do lançamento. Não havia teste afirmando isso — a auditoria de
   * conformidade encontrou o comportamento correto no código, mas sem rede
   * de proteção (nenhum teste falhava se a etiqueta sumisse ou trocasse de
   * entidade).
   */
  it('renderiza a etiqueta PF na linha do lançamento, com o tom correto (Badge tone="pf")', async () => {
    renderDre()
    await abrirLancamentos()

    const editLink = await screen.findByRole('link', { name: 'Editar' })
    const row = editLink.closest('tr') as HTMLElement
    const badge = within(row).getByText('PF')

    expect(badge.className).toContain('bg-surface-pf')
  })
})

/**
 * Figma 11:2 ("Desktop — DRE"), nó `235:64` — a linha "Financiamento
 * apartamento, parcela 13", uma PARCELA de Passivo dentro da tabela
 * "Lançamentos deste mês" (`340:2`).
 *
 * O frame desenha nela o MESMO grupo de ações que desenha em qualquer outra
 * linha Previsto: `235:70` (x=858, w=154) contendo `235:72` "Marcar Pago" e
 * `235:74` "Editar" — byte a byte a mesma geometria de `235:48` ("Internet")
 * e `235:59` ("Contador"). As linhas Pago do mesmo frame (`235:21`, `235:30`,
 * `235:39`) têm o grupo estreito x=956/w=56, só com "Editar".
 *
 * Antes desta correção `EntryRowActions` abria com
 * `if (row.source.kind !== 'Entry') return null`, então a célula de ações da
 * linha de parcela saía VAZIA — 0 botões e 0 links, medido pelo DOM abaixo,
 * contra os 2 que o frame desenha.
 */
describe('DRE — Figma 11:2 §235:64: a linha de parcela de Passivo tem Marcar Pago e Editar', () => {
  const installmentFixture = {
    ...fixture,
    rows: [
      {
        source: {
          kind: 'Installment',
          installmentId: 'installment-13',
          liabilityId: 'liability-apto',
        },
        name: 'Financiamento apartamento, parcela 13',
        entity: 'PF',
        blockId: 'bloco-desp-adm',
        blockName: 'Despesas Administrativas',
        status: 'Planned',
        amount: 152000,
      },
    ],
  }

  it('renderiza "Marcar Pago" (235:72) e "Editar" (235:74) na linha da parcela', async () => {
    vi.mocked(fetchIncomeStatement).mockResolvedValue(
      installmentFixture as unknown as Awaited<ReturnType<typeof fetchIncomeStatement>>,
    )

    renderDre()

    await abrirLancamentos()

    const cell = await screen.findByText('Financiamento apartamento, parcela 13')
    const row = cell.closest('tr') as HTMLElement

    // "Marcar Pago" virou "Confirmar" (dono, 2026-10-06: "receitas não são pagas").
    expect(within(row).getByRole('button', { name: 'Confirmar' })).toBeTruthy()
    expect(within(row).getByRole('link', { name: 'Editar' }).getAttribute('href')).toBe(
      '/passivos/liability-apto',
    )
  })
})

// Pedido do dono, 2026-10-01: "aqui vale mostrar a descrição e o descartar" e
// "o bloco não precisa mostrar".
describe('DRE — Lançamentos deste mês: sem coluna Bloco, com Descartar (2026-10-01)', () => {
  const rowsFixture = {
    ...fixture,
    rows: [
      {
        source: { kind: 'Entry', entryId: 'entry-1' },
        name: 'Categoria sintética',
        entity: 'PF',
        blockId: 'bloco-1',
        blockName: 'Bloco sintético',
        status: 'Planned',
        amount: 1000,
        description: 'Descrição sintética',
      },
      {
        source: { kind: 'Occurrence', occurrenceId: 'occ-1', recurrenceId: 'rec-1' },
        name: 'Recorrência sintética',
        entity: 'PF',
        blockId: 'bloco-1',
        blockName: 'Bloco sintético',
        status: 'Planned',
        amount: 2000,
      },
      {
        source: { kind: 'Installment', installmentId: 'inst-1', liabilityId: 'liab-1' },
        name: 'Parcela sintética',
        entity: 'PF',
        blockId: 'bloco-1',
        blockName: 'Bloco sintético',
        status: 'Planned',
        amount: 3000,
      },
    ],
  }

  beforeEach(() => {
    vi.mocked(fetchIncomeStatement).mockResolvedValue(
      rowsFixture as unknown as Awaited<ReturnType<typeof fetchIncomeStatement>>,
    )
  })

  it('a tabela não tem a coluna Bloco nem o nome do bloco nas linhas', async () => {
    renderDre()
    await abrirLancamentos()
    await screen.findByText('Categoria sintética')
    expect(screen.queryByRole('columnheader', { name: 'Bloco' })).toBeNull()
    expect(screen.queryByText('Bloco sintético')).toBeNull()
  })

  it('mostra a descrição do lançamento abaixo do nome', async () => {
    renderDre()
    await abrirLancamentos()
    const row = (await screen.findByText('Categoria sintética')).closest('tr') as HTMLElement
    expect(within(row).getByText('Descrição sintética')).toBeTruthy()
  })

  // Pedido do dono, 2026-10-01: "vale alguma sinalização para mostrar aquilo
  // que é recorrente".
  it('a linha de recorrência e o lançamento de uma série dizem "Recorrente"; o avulso e a parcela, não', async () => {
    vi.mocked(fetchIncomeStatement).mockResolvedValue({
      ...rowsFixture,
      rows: [
        ...rowsFixture.rows,
        {
          source: { kind: 'Entry', entryId: 'entry-2' },
          name: 'Pago da série',
          entity: 'PF',
          blockId: 'bloco-1',
          blockName: 'Bloco sintético',
          status: 'Paid',
          amount: 4000,
          recurring: true,
        },
      ],
    } as unknown as Awaited<ReturnType<typeof fetchIncomeStatement>>)
    renderDre()
    await abrirLancamentos()
    const rowOf = async (name: string) =>
      (await screen.findByText(name)).closest('tr') as HTMLElement
    expect(
      within(await rowOf('Recorrência sintética')).queryByRole('img', { name: 'Recorrente' }),
    ).toBeTruthy()
    expect(
      within(await rowOf('Pago da série')).queryByRole('img', { name: 'Recorrente' }),
    ).toBeTruthy()
    expect(
      within(await rowOf('Categoria sintética')).queryByRole('img', { name: 'Recorrente' }),
    ).toBeNull()
    expect(
      within(await rowOf('Parcela sintética')).queryByRole('img', { name: 'Recorrente' }),
    ).toBeNull()
  })

  // Pedido do dono, 2026-10-01: "um ícone de olhinho que eu possa ocultar um
  // valor para ver como ficaria o DRE sem esse valor, ou uma categoria toda".
  // Correção do dono, 2026-10-01: "no caso é só aqui, não na outra lista" — o
  // olho mora na cascata, não na tabela "Lançamentos deste mês".
  // Escolha do dono, 2026-10-01, depois de "aquele mostrar tudo não tá legal,
  // porque fica mexendo a tela" e "não ficou bom": texto discreto no fim da
  // barra de controles, "N ocultos · mostrar", só quando há algo oculto.
  it('com algo oculto, o fim da cascata diz "1 oculto · mostrar"; "mostrar" limpa a simulação e o texto some', async () => {
    vi.mocked(fetchIncomeStatement).mockResolvedValue({
      ...fixture,
      lines: [
        {
          kind: 'block',
          key: 'custo',
          label: 'Custo sintético',
          amount: 100,
          level: 0,
          breakdown: [{ key: 'category:a', label: 'Categoria A', amount: 100 }],
        },
      ],
    } as unknown as Awaited<ReturnType<typeof fetchIncomeStatement>>)
    const user = userEvent.setup()
    renderDre()
    await abrirLancamentos()
    await user.click(await screen.findByRole('button', { name: 'Custo sintético' }))
    expect(screen.queryByText(/oculto/)).toBeNull()
    expect(screen.queryByRole('button', { name: /Mostrar ocultos/ })).toBeNull()

    const categoria = screen.getByText('Categoria A').closest('tr') as HTMLElement
    await user.click(within(categoria).getByRole('button', { name: 'Ocultar do DRE' }))
    const aviso = screen.getByText(/1 oculto/)
    // "Vamos fazer no final dessa tabela": no fim do card da cascata, depois
    // da última linha dela, e não na barra de controles.
    const cascata = categoria.closest('table') as HTMLElement
    expect(cascata.compareDocumentPosition(aviso) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(cascata.parentElement?.contains(aviso)).toBe(true)

    await user.click(screen.getByRole('button', { name: 'mostrar' }))
    await waitFor(() =>
      expect(vi.mocked(fetchIncomeStatement)).toHaveBeenLastCalledWith(
        expect.objectContaining({ hidden: undefined }),
      ),
    )
    expect(screen.queryByText(/oculto/)).toBeNull()
  })

  it('a tabela "Lançamentos deste mês" não tem o olhinho', async () => {
    renderDre()
    await abrirLancamentos()
    const row = (await screen.findByText('Categoria sintética')).closest('tr') as HTMLElement
    expect(within(row).queryByRole('button', { name: 'Ocultar do DRE' })).toBeNull()
  })

  // Relato de 2026-10-01: a recorrência "a definir" do mês seguinte não aparecia.
  it('o mês "a definir" em branco aparece com "A definir" no lugar do valor', async () => {
    vi.mocked(fetchIncomeStatement).mockResolvedValue({
      ...rowsFixture,
      rows: [
        {
          source: { kind: 'Occurrence', occurrenceId: 'occ-2', recurrenceId: 'rec-2' },
          name: 'Conta de luz sintética',
          entity: 'PF',
          blockId: 'bloco-1',
          blockName: 'Bloco sintético',
          status: 'Planned',
          amount: 0,
          amountToBeDefined: true,
        },
      ],
    } as unknown as Awaited<ReturnType<typeof fetchIncomeStatement>>)
    renderDre()
    await abrirLancamentos()
    const row = (await screen.findByText('Conta de luz sintética')).closest('tr') as HTMLElement
    expect(within(row).getByText('A definir')).toBeInTheDocument()
    expect(within(row).queryByText('R$ 0,00')).toBeNull()
  })

  // Pedido do dono, 2026-10-01: "separação por (+) e (−) do que é entrada e o
  // que é saída em Lançamentos deste mês".
  it('a tabela separa (+) Entradas e (−) Saídas, cada linha no seu grupo, entradas primeiro', async () => {
    vi.mocked(fetchIncomeStatement).mockResolvedValue({
      ...rowsFixture,
      rows: [
        { ...rowsFixture.rows[0], name: 'Despesa sintética', flow: 'Out' },
        {
          ...rowsFixture.rows[0],
          source: { kind: 'Entry', entryId: 'entry-r' },
          name: 'Receita sintética',
          flow: 'In',
        },
      ],
    } as unknown as Awaited<ReturnType<typeof fetchIncomeStatement>>)
    renderDre()
    await abrirLancamentos()
    const entradas = await screen.findByText('(+) Entradas')
    const saidas = screen.getByText('(−) Saídas')
    const receita = screen.getByText('Receita sintética')
    const despesa = screen.getByText('Despesa sintética')
    const segue = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(segue(entradas, receita)).toBe(true)
    expect(segue(receita, saidas)).toBe(true)
    expect(segue(saidas, despesa)).toBe(true)
  })

  it('toda linha — lançamento, recorrência e parcela — tem "Descartar"', async () => {
    renderDre()
    await abrirLancamentos()
    for (const name of ['Categoria sintética', 'Recorrência sintética', 'Parcela sintética']) {
      const row = (await screen.findByText(name)).closest('tr') as HTMLElement
      expect(within(row).getByRole('button', { name: 'Descartar' })).toBeTruthy()
    }
  })
})

/**
 * Figma 242:2 ("Estado — DRE com Prejuízo (Lucro Líquido negativo)").
 *
 * O frame desenha o card substituto `242:10` com o bloco `242:11` (401×34)
 * SEMPRE em duas linhas: `242:12` título (206×17) + `242:13` legenda (401×15).
 * Card de mensagem com título e sem legenda não existe em nenhum frame — nem
 * aqui, nem no card positivo `239:22` (`239:23` 183×17 + `239:24` 466×15).
 *
 * Medição do defeito: com `netProfit` exatamente 0, o ramo "sem lucro" de
 * `page.tsx` condicionava a legenda a `isNegative(netProfit)`, então o DOM saía
 * com 1 nó de texto no card ("Sem lucro a destinar este mês") contra os 2 que
 * `242:11` desenha — uma terceira variante de card, de altura reduzida, que o
 * design nunca desenhou.
 */
describe('DRE — Figma 242:2: o card "Sem lucro a destinar este mês" tem título E legenda', () => {
  async function noProfitCardBody(netProfit: number) {
    vi.mocked(fetchIncomeStatement).mockResolvedValue({
      ...fixture,
      netProfit,
    } as unknown as Awaited<ReturnType<typeof fetchIncomeStatement>>)

    renderDre()

    await abrirLancamentos()

    const title = await screen.findByRole('heading', { name: 'Sem lucro a destinar este mês' })
    return title.parentElement as HTMLElement
  }

  it('com Lucro Líquido exatamente zero, imprime a legenda de 242:13 sem a sentença do prejuízo', async () => {
    const body = await noProfitCardBody(0)

    expect(body.textContent).toBe(
      'Sem lucro a destinar este mêsNão há valor pra investir, guardar ou distribuir.',
    )
  })

  it('com prejuízo, imprime a legenda de 242:13 inteira, com o valor em magnitude', async () => {
    const body = await noProfitCardBody(-185_000)

    expect(body.textContent).toBe(
      // `formatMoney` usa o espaço não separável que o `Intl` pt-BR emite entre
      // "R$" e o número; o valor sai em MAGNITUDE, como o frame escreve em 242:13.
      'Sem lucro a destinar este mês' +
        'Prejuízo de R$\u00a01.850,00. Não há valor pra investir, guardar ou distribuir.',
    )
  })
})

/**
 * P42 — a ordem de leitura, conferida contra `docs/figma/frames/11-2__desktop-dre.xml`.
 *
 * Os nós de texto do frame, na ordem em que aparecem na área de conteúdo:
 * título "DRE" → a ajuda → o seletor de visão (Consolidado · PF · PJ) → o
 * seletor Pago/Previsto → a navegação de mês (← Julho 2026 →) → a cascata →
 * a tabela "Lançamentos deste mês" (frame 239:37), que fecha a tela.
 *
 * A auditoria cruzada anterior teria passado com esses seis elementos em
 * qualquer ordem: ela comparava presença de texto, não posição.
 */
describe('DRE — ordem de leitura (P42, frame 11:2)', () => {
  it('título, visão, Pago/Previsto, mês e cascata aparecem nesta ordem', async () => {
    renderDre()
    await abrirLancamentos()
    await screen.findByRole('link', { name: 'Editar' })

    const labels = ['DRE (título)', 'Consolidado', 'Pago', 'mês', 'Lançamentos deste mês']
    assertReadingOrder(
      [
        screen.getByRole('heading', { name: 'DRE', level: 1 }),
        screen.getByRole('radio', { name: 'Consolidado' }),
        screen.getByRole('radio', { name: 'Pago' }),
        screen.getByRole('button', { name: 'Mês anterior' }),
        screen.getByRole('heading', { name: 'Lançamentos deste mês', level: 2 }),
      ],
      labels,
    )
  })
})

/**
 * H3 — o toggle Pago/Previsto ao navegar entre meses.
 *
 * A regra está escrita em dois lugares e, até 2026-09-11, guardada em nenhum:
 * `defaultStatusFilterFor` (domínio, com teste) decide o padrão por mês —
 * "Pago em mês atual/passado, Previsto em mês futuro" (files_design/01 §8.1) —,
 * mas o comportamento de TELA que completa a regra não tinha teste: uma vez que
 * a pessoa vira o toggle na mão, a escolha dela gruda ao navegar, em vez de o
 * padrão sobrescrevê-la a cada mês.
 *
 * É a parte que quebra em silêncio: quem muda para "Previsto" no mês atual e
 * avança um mês não percebe que voltou para "Pago", porque o número muda de
 * qualquer jeito quando o mês muda.
 *
 * "Hoje" é 2026-08 no mock do arquivo.
 */
describe('DRE — o toggle Pago/Previsto ao trocar de mês (H3)', () => {
  // Só as chamadas da cascata: o "Caixa do mês" (2026-10-09) também pede o
  // relatório, sempre em Previsto, para a ponte. A cascata é a que leva `hidden`.
  const statusPedido = () =>
    vi
      .mocked(fetchIncomeStatement)
      .mock.calls.filter(([query]) => 'hidden' in query)
      .at(-1)?.[0]?.statusFilter

  it('sem intervenção, segue o padrão do mês: Pago no atual, Previsto no futuro', async () => {
    const user = userEvent.setup()
    renderDre()
    await abrirLancamentos()
    await screen.findByRole('link', { name: 'Editar' })
    expect(statusPedido()).toBe('Paid')

    await user.click(screen.getByRole('button', { name: 'Próximo mês' }))
    await vi.waitFor(() => expect(statusPedido()).toBe('Planned'))
  })

  it('depois de a pessoa escolher na mão, a escolha dela gruda ao trocar de mês', async () => {
    const user = userEvent.setup()
    renderDre()
    await abrirLancamentos()
    await screen.findByRole('link', { name: 'Editar' })

    // Escolhe "Previsto" no mês ATUAL — contra o padrão, que seria Pago.
    await user.click(screen.getByRole('radio', { name: 'Previsto' }))
    await vi.waitFor(() => expect(statusPedido()).toBe('Planned'))

    // Volta um mês: o padrão desse mês seria "Pago", mas a escolha manda.
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }))
    await vi.waitFor(() => expect(statusPedido()).toBe('Planned'))
  })
})

/**
 * DRE expansível (pedido de produto, 2026-09-23): a linha de bloco com
 * movimento ganha uma seta que abre o total por categoria. Começa recolhida;
 * subtotal (=) e bloco zerado não têm seta. Dados sintéticos.
 */
describe('DRE — linha de bloco expansível por categoria', () => {
  function withLines() {
    vi.mocked(fetchIncomeStatement).mockResolvedValue({
      ...fixture,
      lines: [
        {
          kind: 'block',
          key: 'custo',
          label: 'Custo sintético',
          amount: 50_831,
          level: 0,
          breakdown: [
            { key: 'category:a', label: 'Categoria A', amount: 25_500 },
            { key: 'category:b', label: 'Categoria B', amount: 25_331 },
          ],
        },
        { kind: 'block', key: 'zerado', label: 'Bloco zerado', amount: 0, level: 0, breakdown: [] },
        { kind: 'subtotal', key: 'ebitda', label: 'EBITDA', amount: -50_831, level: 0 },
      ],
    } as unknown as Awaited<ReturnType<typeof fetchIncomeStatement>>)
  }

  it('começa recolhida: a seta está lá, as categorias não', async () => {
    withLines()
    renderDre()
    await abrirLancamentos()

    const toggle = await screen.findByRole('button', { name: 'Custo sintético' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Categoria A')).not.toBeInTheDocument()
  })

  it('clicar abre o total por categoria, e clicar de novo fecha', async () => {
    withLines()
    const user = userEvent.setup()
    renderDre()
    await abrirLancamentos()

    const toggle = await screen.findByRole('button', { name: 'Custo sintético' })
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Categoria A')).toBeInTheDocument()
    expect(screen.getByText('R$ 253,31')).toBeInTheDocument()

    await user.click(toggle)
    expect(screen.queryByText('Categoria A')).not.toBeInTheDocument()
  })

  it('2026-10-01 — o olhinho de uma categoria pede o DRE sem a categoria inteira', async () => {
    withLines()
    const user = userEvent.setup()
    renderDre()
    await abrirLancamentos()
    await user.click(await screen.findByRole('button', { name: 'Custo sintético' }))
    const categoria = screen.getByText('Categoria A').closest('tr') as HTMLElement
    await user.click(within(categoria).getByRole('button', { name: 'Ocultar do DRE' }))
    await waitFor(() =>
      expect(vi.mocked(fetchIncomeStatement)).toHaveBeenLastCalledWith(
        expect.objectContaining({ hidden: 'group:category:a' }),
      ),
    )
  })

  it('2026-10-01 — o lançamento dentro da categoria aberta também tem o olhinho, na ponta direita, e oculta só ele', async () => {
    vi.mocked(fetchIncomeStatement).mockResolvedValue({
      ...fixture,
      lines: [
        {
          kind: 'block',
          key: 'custo',
          label: 'Custo sintético',
          amount: 25_500,
          level: 0,
          breakdown: [{ key: 'category:a', label: 'Categoria A', amount: 25_500 }],
        },
      ],
      rows: [
        {
          source: { kind: 'Entry', entryId: 'manutencao-1' },
          name: 'Categoria A',
          entity: 'PF',
          categoryId: 'a',
          blockId: 'custo',
          blockName: 'Custo sintético',
          status: 'Paid',
          amount: 25_500,
          description: 'Manutenção sintética',
        },
      ],
    } as unknown as Awaited<ReturnType<typeof fetchIncomeStatement>>)
    const user = userEvent.setup()
    renderDre()
    await abrirLancamentos()
    await user.click(await screen.findByRole('button', { name: 'Custo sintético' }))
    await user.click(screen.getByRole('button', { name: 'Categoria A' }))
    const lista = screen.getByRole('list', { name: 'Lançamentos da categoria' })
    const item = within(lista)
      .getByText(/Manutenção sintética/)
      .closest('li') as HTMLElement
    const olho = within(item).getByRole('button', { name: 'Ocultar do DRE' })
    // Escolha do dono, 2026-10-01: o olho na ponta direita, depois do valor.
    expect(item.lastElementChild?.contains(olho)).toBe(true)
    await user.click(olho)
    await waitFor(() =>
      expect(vi.mocked(fetchIncomeStatement)).toHaveBeenLastCalledWith(
        expect.objectContaining({ hidden: 'entry:manutencao-1' }),
      ),
    )
  })

  it('bloco zerado e subtotal não têm seta', async () => {
    withLines()
    renderDre()
    await abrirLancamentos()

    await screen.findByRole('button', { name: 'Custo sintético' })
    expect(screen.queryByRole('button', { name: 'Bloco zerado' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'EBITDA' })).not.toBeInTheDocument()
  })
})

// "Destinação de lucro previsto não faz sentido" (dono, 2026-10-01): lucro
// Previsto é projeção; só se destina o que aconteceu.
describe('DRE — Destinar o lucro só com a cascata em Pago', () => {
  it('em Previsto, nem "Destinar o lucro deste mês" nem "Sem lucro a destinar" aparecem', async () => {
    vi.mocked(fetchIncomeStatement).mockResolvedValue({
      ...fixture,
      statusFilter: 'Planned',
      netProfit: 500_000,
    } as unknown as Awaited<ReturnType<typeof fetchIncomeStatement>>)
    renderDre()
    await abrirLancamentos()
    await screen.findByText('Categoria sintética')
    expect(screen.queryByText('Destinar o lucro deste mês')).toBeNull()
    expect(screen.queryByText('Sem lucro a destinar este mês')).toBeNull()
  })

  it('em Pago com lucro, o card aparece', async () => {
    vi.mocked(fetchIncomeStatement).mockResolvedValue({
      ...fixture,
      netProfit: 500_000,
    } as unknown as Awaited<ReturnType<typeof fetchIncomeStatement>>)
    renderDre()
    await abrirLancamentos()
    expect(await screen.findByText('Destinar o lucro deste mês')).toBeInTheDocument()
  })
})

// "Ver previsão do mês" (PRD v7.40) saiu em 2026-10-01: "remove esse uma vez
// que já tem o Pago | Previsto" (dono).
describe('DRE — sem "Ver previsão do mês"', () => {
  it('a barra tem Pago | Previsto e o mês, e não tem o botão de previsão', async () => {
    renderDre()
    await abrirLancamentos()
    await screen.findByRole('heading', { name: 'DRE' })
    expect(screen.queryByRole('button', { name: 'Ver previsão do mês' })).toBeNull()
    expect(screen.getByRole('radio', { name: 'Pago' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Previsto' })).toBeInTheDocument()
  })
})

describe('DRE — filtros, Exibir tudo e total (ADR-0021, dono 2026-10-06)', () => {
  const linhas = {
    ...fixture,
    lines: [
      {
        kind: 'block',
        key: 'bloco-adm',
        label: 'Despesas Administrativas',
        amount: 3000,
        breakdown: [{ key: 'category:cat-a', label: 'Assinaturas', amount: 3000 }],
      },
    ],
    rows: [
      {
        source: { kind: 'Entry', entryId: 'entry-in' },
        name: 'Receita sintética',
        entity: 'PF',
        categoryId: 'cat-r',
        blockId: 'bloco-receita',
        blockName: 'Receita Bruta',
        status: 'Paid',
        amount: 10000,
        flow: 'In',
      },
      {
        source: { kind: 'Entry', entryId: 'entry-card' },
        name: 'Assinaturas',
        entity: 'PF',
        categoryId: 'cat-a',
        blockId: 'bloco-adm',
        blockName: 'Despesas Administrativas',
        status: 'Paid',
        amount: 3000,
        flow: 'Out',
        isCreditCard: true,
        recurring: true,
        date: '2026-08-12',
      },
    ],
  }

  beforeEach(() => {
    vi.mocked(fetchIncomeStatement).mockResolvedValue(
      linhas as unknown as Awaited<ReturnType<typeof fetchIncomeStatement>>,
    )
  })

  it('ADR-0021 — "Cartão" e "Recorrentes" pedem a cascata recalculada ao servidor', async () => {
    const user = userEvent.setup()
    renderDre()
    await abrirLancamentos()
    await user.click(await screen.findByRole('button', { name: 'Cartão', pressed: false }))
    await waitFor(() =>
      expect(vi.mocked(fetchIncomeStatement)).toHaveBeenLastCalledWith(
        expect.objectContaining({ creditCard: 'true', recurring: 'false' }),
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Recorrentes', pressed: false }))
    await waitFor(() =>
      expect(vi.mocked(fetchIncomeStatement)).toHaveBeenLastCalledWith(
        expect.objectContaining({ creditCard: 'true', recurring: 'true' }),
      ),
    )
  })

  it('dono 2026-10-06 — "Exibir tudo" abre blocos e categorias; vira "Recolher tudo"', async () => {
    const user = userEvent.setup()
    renderDre()
    await abrirLancamentos()
    await user.click(await botaoDaCascata('Exibir tudo'))
    const lista = await screen.findByRole('list', { name: 'Lançamentos da categoria' })
    expect(within(lista).getByText('12/08/2026')).toBeInTheDocument()
    expect(within(lista).getByRole('img', { name: 'Recorrente' })).toBeInTheDocument()
    expect(within(lista).getByRole('img', { name: 'Cartão de crédito' })).toBeInTheDocument()
    // Sem seletor de categoria na linha (dono, 2026-10-06: "melhor a pessoa
    // editar para escolher"): o "Editar" abre o formulário do lançamento.
    expect(within(lista).queryByRole('combobox')).toBeNull()
    expect(within(lista).getByRole('link', { name: 'Editar' })).toHaveAttribute(
      'href',
      '/novo-lancamento?from=dre&entryId=entry-card',
    )
    await user.click(await botaoDaCascata('Recolher tudo'))
    expect(screen.queryByRole('list', { name: 'Lançamentos da categoria' })).toBeNull()
  })

  it('dono 2026-10-06 — os grupos de "Lançamentos deste mês" começam fechados, com o total no cabeçalho', async () => {
    const user = userEvent.setup()
    renderDre()
    const entradas = await screen.findByRole('button', { name: /\(\+\) Entradas/ })
    const saidas = screen.getByRole('button', { name: /\(−\) Saídas/ })
    expect(entradas).toHaveAttribute('aria-expanded', 'false')
    const tabela = entradas.closest('table') as HTMLElement
    expect(
      within(entradas.closest('tr') as HTMLElement).getByText(/R\$\s100,00/),
    ).toBeInTheDocument()
    expect(within(saidas.closest('tr') as HTMLElement).getByText(/R\$\s30,00/)).toBeInTheDocument()
    const saldo = within(tabela).getByText('Saldo').closest('tr') as HTMLElement
    expect(within(saldo).getByText(/R\$\s70,00/)).toBeInTheDocument()
    // Fechado, nenhuma linha de lançamento aparece; um clique abre o grupo.
    expect(within(tabela).queryByText('Assinaturas')).toBeNull()
    await user.click(saidas)
    expect(saidas).toHaveAttribute('aria-expanded', 'true')
    const despesa = within(tabela).getByText('Assinaturas').closest('tr') as HTMLElement
    expect(within(despesa).getByRole('img', { name: 'Cartão de crédito' })).toBeInTheDocument()
    expect(within(tabela).queryByText('Receita sintética')).toBeNull()
  })

  it('dono 2026-10-06 — "Lançamentos deste mês" tem o próprio "Exibir tudo", que abre os dois grupos', async () => {
    const user = userEvent.setup()
    renderDre()
    const entradas = await screen.findByRole('button', { name: /\(\+\) Entradas/ })
    const card = entradas.closest('[data-dre-entries-card]') as HTMLElement
    await user.click(within(card).getByRole('button', { name: 'Exibir tudo' }))
    expect(entradas).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /\(−\) Saídas/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await user.click(within(card).getByRole('button', { name: 'Recolher tudo' }))
    expect(entradas).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('DRE — "Confirmar" e "Desfazer" (dono, 2026-10-06)', () => {
  it('dono 2026-10-06 — lançamento Pago tem "Desfazer", e não "Confirmar"', async () => {
    renderDre()
    await abrirLancamentos()
    const editar = await screen.findByRole('link', { name: 'Editar' })
    const row = editar.closest('tr') as HTMLElement
    expect(within(row).getByRole('button', { name: 'Desfazer' })).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'Confirmar' })).toBeNull()
  })

  it('dono 2026-10-06 — lançamento Previsto tem "Confirmar", e não "Desfazer"', async () => {
    vi.mocked(fetchIncomeStatement).mockResolvedValue({
      ...fixture,
      rows: [{ ...fixture.rows[0], status: 'Planned' }],
    } as unknown as Awaited<ReturnType<typeof fetchIncomeStatement>>)
    renderDre()
    await abrirLancamentos()
    const editar = await screen.findByRole('link', { name: 'Editar' })
    const row = editar.closest('tr') as HTMLElement
    expect(within(row).getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'Desfazer' })).toBeNull()
  })
})

describe('DRE — a lista de lançamentos não alarga o card (captura do dono, 2026-10-06)', () => {
  it('dono 2026-10-06 — a lista contém a largura intrínseca, para a descrição cortar em vez de empurrar os valores', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchIncomeStatement).mockResolvedValue({
      ...fixture,
      lines: [
        {
          kind: 'block',
          key: 'bloco-1',
          label: 'Receita',
          amount: 1000,
          breakdown: [{ key: 'category:cat-1', label: 'Categoria sintética', amount: 1000 }],
        },
      ],
      rows: [{ ...fixture.rows[0], categoryId: 'cat-1' }],
    } as unknown as Awaited<ReturnType<typeof fetchIncomeStatement>>)
    renderDre()
    await abrirLancamentos()
    await user.click(await botaoDaCascata('Exibir tudo'))
    const lista = await screen.findByRole('list', { name: 'Lançamentos da categoria' })
    expect(lista.className).toContain('[contain:inline-size]')
  })
})

describe('DRE — filtro sem resultado (medido em 2026-10-06)', () => {
  it('dono 2026-10-06 — com filtro e nada que bata, diz isso, e não manda "registrar o primeiro lançamento"', async () => {
    const user = userEvent.setup()
    renderDre()
    await abrirLancamentos()
    await screen.findByRole('link', { name: 'Editar' })
    vi.mocked(fetchIncomeStatement).mockResolvedValue({
      ...fixture,
      rows: [],
    } as unknown as Awaited<ReturnType<typeof fetchIncomeStatement>>)
    await user.click(screen.getByRole('button', { name: 'Cartão' }))
    expect(await screen.findByText('Nenhum lançamento com este filtro.')).toBeInTheDocument()
    expect(screen.queryByText(/pra começar/)).toBeNull()
  })
})

describe('DRE — barra de controles (dono, 2026-10-06)', () => {
  it('dono 2026-10-06 — os filtros ficam à esquerda do mês, e "Exibir tudo" é um botão dentro do card da cascata', async () => {
    vi.mocked(fetchIncomeStatement).mockResolvedValue({
      ...fixture,
      lines: [
        {
          kind: 'block',
          key: 'bloco-1',
          label: 'Receita',
          amount: 1000,
          breakdown: [{ key: 'category:cat-1', label: 'Categoria sintética', amount: 1000 }],
        },
      ],
    } as unknown as Awaited<ReturnType<typeof fetchIncomeStatement>>)
    renderDre()
    await abrirLancamentos()
    const filtros = await screen.findByRole('group', { name: 'Filtrar lançamentos' })
    const mes = screen.getByRole('button', { name: /mês anterior/i })
    expect(filtros.compareDocumentPosition(mes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const exibir = await botaoDaCascata('Exibir tudo')
    // Dentro do card, junto da cascata que ele abre (dono: "melhor dentro").
    expect(exibir.closest('[data-dre-controls]')).toBeNull()
    const cascata = screen.getByText(/Cascata do DRE/).closest('table') as HTMLElement
    expect(exibir.compareDocumentPosition(cascata) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(exibir.closest('[data-dre-cascade-card]')).toBe(
      cascata.closest('[data-dre-cascade-card]'),
    )
    expect(exibir.className).toContain('border-line-control')
  })
})

describe('DRE — destinar o lucro é do resultado consolidado (medido em 2026-10-09)', () => {
  /**
   * PRD §5 (modelo de dados): "a destinação do lucro é um valor único
   * consolidado, não replicado por entidade". Medido em 2026-10-09: na visão PJ
   * o diálogo oferecia os R$ 26.500,00 da PJ, o servidor validava contra o
   * Consolidado (menor) e respondia `profit_allocation.exceeds_net_profit`, que
   * a tela mostrava como "A operação não pôde ser concluída."
   */
  it('2026-10-09 — na visão PJ não há "Destinar este Lucro"; o card diz que a destinação é do consolidado', async () => {
    vi.mocked(fetchIncomeStatement).mockResolvedValue({
      ...fixture,
      view: 'PJ',
      netProfit: 2_650_000,
    } as unknown as Awaited<ReturnType<typeof fetchIncomeStatement>>)
    renderDre()
    expect(await screen.findByText(/resultado consolidado/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Destinar este Lucro' })).toBeNull()
  })

  it('2026-10-09 — com um filtro ligado, a cascata é hipótese: não há "Destinar este Lucro"', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchIncomeStatement).mockResolvedValue({
      ...fixture,
      netProfit: 2_650_000,
    } as unknown as Awaited<ReturnType<typeof fetchIncomeStatement>>)
    renderDre()
    expect(await screen.findByRole('button', { name: 'Destinar este Lucro' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Recorrentes' }))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Destinar este Lucro' })).toBeNull(),
    )
  })
})

describe('DRE — "Vincular ao banco" (dono, 2026-10-09)', () => {
  it('dono 2026-10-09 — o lançamento feito à mão tem "Vincular ao banco" em "Lançamentos deste mês"', async () => {
    renderDre()
    await abrirLancamentos()
    const row = (await screen.findByRole('link', { name: 'Editar' })).closest('tr') as HTMLElement
    expect(within(row).getByRole('button', { name: 'Vincular ao banco' })).toBeInTheDocument()
  })
})

describe('DRE — Previsto é a previsão completa (dono, 2026-10-09)', () => {
  it('dono 2026-10-09 — em Previsto, a lista da categoria mostra o pago e o previsto que a linha soma', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchIncomeStatement).mockResolvedValue({
      ...fixture,
      statusFilter: 'Planned',
      lines: [
        {
          kind: 'block',
          key: 'bloco-adm',
          label: 'Despesas Administrativas',
          amount: 3000,
          breakdown: [{ key: 'category:cat-a', label: 'Assinaturas', amount: 3000 }],
        },
      ],
      rows: [
        {
          ...fixture.rows[0],
          source: { kind: 'Entry', entryId: 'pago' },
          name: 'Pago sintético',
          categoryId: 'cat-a',
          blockId: 'bloco-adm',
          status: 'Paid',
          amount: 1000,
          description: 'Pago sintético',
        },
        {
          ...fixture.rows[0],
          source: { kind: 'Entry', entryId: 'previsto' },
          name: 'Previsto sintético',
          categoryId: 'cat-a',
          blockId: 'bloco-adm',
          status: 'Planned',
          amount: 2000,
          description: 'Previsto sintético',
        },
      ],
    } as unknown as Awaited<ReturnType<typeof fetchIncomeStatement>>)
    renderDre()
    await user.click(await botaoDaCascata('Exibir tudo'))
    const lista = await screen.findByRole('list', { name: 'Lançamentos da categoria' })
    expect(within(lista).getByText(/Pago sintético/)).toBeInTheDocument()
    expect(within(lista).getByText(/Previsto sintético/)).toBeInTheDocument()
  })
})

// Card desligado na tela em 2026-10-09 ("ainda não tá como eu quero").
describe.skip('DRE — "Caixa do mês" (dono, 2026-10-09)', () => {
  it('dono 2026-10-09 — mostra o saldo por banco, o que ainda está previsto e o saldo previsto; o olhinho tira um banco', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchIncomeStatement).mockResolvedValue({
      ...fixture,
      rows: [
        { ...fixture.rows[0], status: 'Planned', amount: 20_000, flow: 'In' },
        {
          ...fixture.rows[0],
          source: { kind: 'Entry', entryId: 'e-2' },
          status: 'Planned',
          amount: 5_000,
          flow: 'Out',
        },
      ],
    } as unknown as Awaited<ReturnType<typeof fetchIncomeStatement>>)
    renderDre()
    const card = (await screen.findByRole('heading', { name: 'Caixa do mês' })).closest(
      '[data-dre-cash-card]',
    ) as HTMLElement
    const linha = (rotulo: string | RegExp) =>
      within(card).getByText(rotulo).closest('[data-cash-line]') as HTMLElement
    expect(within(linha('Saldo hoje')).getByText(/R\$\s1\.500,00/)).toBeInTheDocument()
    expect(within(linha('Ainda previsto')).getByText(/R\$\s150,00/)).toBeInTheDocument()
    expect(
      within(linha('Saldo previsto no fim do mês')).getByText(/R\$\s1\.650,00/),
    ).toBeInTheDocument()

    await user.click(within(linha('Banco Sintético B')).getByRole('button'))
    expect(within(linha('Saldo hoje')).getByText(/R\$\s1\.000,00/)).toBeInTheDocument()
  })
})

// Card desligado na tela em 2026-10-09 ("ainda não tá como eu quero").
describe.skip('DRE — "Caixa do mês": do início ao fim do mês (dono, 2026-10-09)', () => {
  it('dono 2026-10-09 — início + Lucro Líquido (previsão completa) + fora do DRE = saldo previsto no fim', async () => {
    vi.mocked(fetchIncomeStatement).mockResolvedValue({
      ...fixture,
      netProfit: 30_000,
      rows: [{ ...fixture.rows[0], status: 'Planned', amount: 20_000, flow: 'In' }],
    } as unknown as Awaited<ReturnType<typeof fetchIncomeStatement>>)
    renderDre()
    const card = (await screen.findByRole('heading', { name: 'Caixa do mês' })).closest(
      '[data-dre-cash-card]',
    ) as HTMLElement
    const linha = (rotulo: string) =>
      within(card).getByText(rotulo).closest('[data-cash-line]') as HTMLElement
    // Hoje 1.500 (A 1.000 + B 500); o extrato moveu +400 em A → início 1.100.
    expect(
      within(await waitFor(() => linha('Saldo no início do mês'))).getByText(/R\$\s1\.100,00/),
    ).toBeInTheDocument()
    expect(within(linha('Lucro Líquido do mês')).getByText(/R\$\s300,00/)).toBeInTheDocument()
    // Fim 1.700 (1.500 + 200 previsto) − 1.100 − 300 = 300.
    expect(within(linha('Fora do DRE')).getByText(/R\$\s300,00/)).toBeInTheDocument()
  })
})
