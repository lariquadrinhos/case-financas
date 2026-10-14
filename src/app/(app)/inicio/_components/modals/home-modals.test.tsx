import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cents, month } from '@/domain/core'
import { BlockDetailModal } from './block-detail-modal'
import { CategoryDetailModal } from './category-detail-modal'
import { FlowDetailModal } from './flow-detail-modal'
import { DiscretionaryExpenseModal } from './discretionary-expense-modal'
import { DiscretionaryDetailModal } from './discretionary-detail-modal'
import { DirecionarSobraModal } from './direcionar-sobra-modal'

/**
 * Os seis "modais sobre Início" (frames 345:2, 345:252, 345:502, 345:752,
 * 345:1002, 349:2). Dois defeitos reais motivaram estes testes, e cada um
 * deles é a inversão verificada da regra que o teste protege.
 */

// Radix Popover (o dropdown de "Buscar e Criar") mede o gatilho ao abrir; o
// jsdom não tem ResizeObserver.
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

/**
 * INVERSÃO 1 (verificada): "Gastei um valor" envolvia o campo num
 * `<Field className="sr-only">`. `sr-only` recorta o elemento E tudo dentro
 * dele, então o INPUT sumia junto com o rótulo e o modal ficava sem onde
 * digitar o valor — confirmado no browser (caixa de 1×1px, `clip-path:
 * inset(50%)`). Restaurando o `sr-only` no ancestral, este teste fica
 * vermelho; sem ele, verde.
 *
 * A checagem é estrutural porque o jsdom não carrega o CSS do Tailwind:
 * `toBeVisible()` olha `style`/`hidden`, nunca uma classe utilitária, e por
 * isso passaria com o campo recortado.
 *
 * Em 2026-09-11 o rótulo passou a ser VISÍVEL: o comentário do componente dizia
 * que "o frame não desenha rótulo", certo sobre o Wireframe e errado sobre a
 * Mockup, que acrescentou o `Campo` com "Valor *" ao aplicar a camada visual
 * (ADR-0015 — a Mockup vence). Por isso a busca passou a incluir o asterisco:
 * o `getByLabelText` casa o TEXTO do `<label>`, e ali ele agora lê "Valor *".
 */
describe('Gastei um valor (frame 345:1252) — o campo de valor tem que estar à vista', () => {
  it('tem um campo "Valor" que não está dentro de um contêiner só-para-leitor-de-tela', () => {
    renderWithQueryClient(
      <DiscretionaryExpenseModal open onOpenChange={() => {}} month={month('2026-07')} />,
    )

    const field = screen.getByLabelText(/^Valor \*$/)

    expect(field).toBeInTheDocument()
    expect(field.closest('.sr-only')).toBeNull()
  })

  it('mostra a máscara de moeda zerada e o botão Confirmar, palavra por palavra', () => {
    renderWithQueryClient(
      <DiscretionaryExpenseModal open onOpenChange={() => {}} month={month('2026-07')} />,
    )

    // `\s` e não um espaço literal: o `Intl` do pt-BR separa "R$" do número
    // com espaço NÃO-quebrável, que é o espaço que o doc08 §1 pede.
    const field = screen.getByLabelText(/^Valor \*$/) as HTMLInputElement
    expect(field.value).toMatch(/^R\$\s0,00$/)
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
  })

  /**
   * INVERSÃO 3 (verificada): a legenda saía como `<DialogDescription>` dentro
   * do `<DialogHeader>`, ou seja LOGO ABAIXO do título — acima do campo e do
   * botão. As duas páginas do Figma desenham a mesma ordem, e é a outra:
   * Wireframe 345:1252 (320×183) põe título 345:1253 em y=20, campo 345:1254
   * em y=50, "Confirmar" 345:1256 em y=102 e a legenda 345:1258 em y=150;
   * Mockup 1000:2643 (320×270) repete com 1000:2644 y=24, 1000:2645 y=70,
   * 1000:2649 y=150 e 1000:2651 y=210. Em nenhuma das duas a legenda antecede
   * o botão. Devolvendo a legenda ao `<DialogHeader>`, este teste fica
   * vermelho.
   *
   * A checagem é de ordem de DOM (`compareDocumentPosition`) porque é isso que
   * o frame decide: o jsdom não tem layout, então posição em pixel não existe
   * aqui — a ordem do documento é a única testemunha disponível da ordem
   * desenhada.
   */
  it('põe a legenda DEPOIS do botão Confirmar, como nos frames 345:1252 e 1000:2643', () => {
    renderWithQueryClient(
      <DiscretionaryExpenseModal open onOpenChange={() => {}} month={month('2026-07')} />,
    )

    const confirmar = screen.getByRole('button', { name: 'Confirmar' })
    const legenda = screen.getByText(
      'Sem categoria, sem conta, sem data pra escolher, só o valor. A barra atualiza na hora.',
    )

    // A legenda continua sendo o `aria-describedby` do diálogo: mudou de
    // lugar no DOM, não de papel.
    expect(legenda.id).toBe('gastei-um-valor-legenda')
    expect(
      confirmar.compareDocumentPosition(legenda) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

/**
 * INVERSÃO 2 (verificada): Detalhe do Bloco, Detalhe da Categoria e Detalhe do
 * Fluxo não tinham `<DialogTitle>` nenhum — os frames não desenham título
 * visível, e o título foi omitido junto. `aria-labelledby` vinha `null` no
 * browser, ou seja, o leitor de tela anunciava "diálogo" e mais nada.
 * Removendo o `<DialogTitle>` de qualquer um dos três, o teste correspondente
 * fica vermelho ("Unable to find role=dialog with name…").
 *
 * O nome invisível é o NOME DO FRAME, palavra por palavra, e nada além dele.
 * Medido: o diálogo de Categoria não tem nó de texto antes do filete
 * (Wireframe 183:2 abre em `183:3` "← Despesas por Categoria" x=28 y=28;
 * Mockup 1002:2841 abre em `1022:3017` "Link"), e o de Bloco também não
 * (Wireframe 189:23 → `189:24`; Mockup 1002:3118 → `1022:3025`). Como não há
 * texto desenhado pra copiar, o nome vem do nome do frame — "Detalhe da
 * Categoria" (345:2 / 1002:2607) e "Detalhe do Bloco" (345:252 / 1002:2884).
 * A composição "…: {nome do dado}" que o código trazia antes não existe em
 * frame nenhum, nem no glossário `files_design/04`: o dado fica na descrição,
 * onde o leitor de tela também o anuncia. Por isso o nome é conferido POR
 * IGUALDADE, não por `/regex/` — um regex de "Casa" aceitaria de volta
 * qualquer sufixo inventado.
 */
describe('todo modal sobre Início tem nome acessível, mesmo sem título visível', () => {
  it('Detalhe do Bloco usa o nome do frame 345:252, sem sufixo inventado', () => {
    renderWithQueryClient(
      <BlockDetailModal
        open
        onOpenChange={() => {}}
        block={{
          id: 'acc-1',
          name: 'Nubank',
          value: cents(420_000),
          kind: 'BankAccount',
          items: [{ id: 'acc-1', name: 'Nubank', value: cents(420_000), entity: 'PF' }],
        }}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Detalhe do Bloco' })
    expect(dialog).toBeInTheDocument()
    // O bloco continua sendo anunciado — pela descrição, que tem fonte.
    expect(dialog).toHaveAccessibleDescription(/Nubank/)
  })

  it('Detalhe da Categoria usa o nome do frame 345:2, sem sufixo inventado', () => {
    renderWithQueryClient(
      <CategoryDetailModal
        open
        onOpenChange={() => {}}
        month={month('2026-07')}
        category={{
          id: 'cat-1',
          name: 'Casa',
          blockId: 'despesas-administrativas',
          isSystem: false,
          archived: false,
          isPassiveIncome: false,
          suggestedClassification: null,
        }}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Detalhe da Categoria' })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAccessibleDescription(/Casa/)
  })

  it('Detalhe do Fluxo nomeia a linha clicada (frame 349:252)', () => {
    render(
      <FlowDetailModal
        open
        onOpenChange={() => {}}
        selection={{ name: 'Salário', total: cents(1_800_000), rows: [] }}
      />,
    )

    expect(screen.getByRole('dialog', { name: /Salário/ })).toBeInTheDocument()
  })
})

/**
 * PRD v7 fecha a renomeação "Mapa de Fluxo → Entradas e Saídas" e diz que "os
 * nomes válidos são os desta v7". O card já se chama Entradas e Saídas; o link
 * de volta do modal ainda dizia Mapa de Fluxo, dando dois nomes ao mesmo card
 * na mesma tela.
 */
describe('Detalhe do Fluxo — vocabulário fechado (PRD v7, renomeações)', () => {
  it('o link de volta nomeia o card de onde veio: Entradas e Saídas', () => {
    render(
      <FlowDetailModal
        open
        onOpenChange={() => {}}
        selection={{ name: 'Salário', total: cents(1_800_000), rows: [] }}
      />,
    )

    // A seta é `aria-hidden` (é decoração), então o nome acessível do link de
    // volta é só o nome do card.
    expect(screen.getByRole('button', { name: 'Entradas e Saídas' })).toBeInTheDocument()
    expect(screen.queryByText(/Mapa de Fluxo/)).toBeNull()
  })
})

/**
 * files_design/01 §13 ("mostra a composição do valor, ex.: Investimentos =
 * Tesouro Direto + Ações XP") + docs/figma/frames/345-252, nó 189:23, desenha
 * DUAS linhas de Composição para o bloco agregado. Antes desta correção, o
 * corpo do modal sempre renderizava exatamente 1 linha (`block.name` +
 * `block.value`), então este teste ficava vermelho para qualquer bloco com
 * mais de um item.
 */
describe('Detalhe do Bloco — Composição de um bloco agregado (Investimentos, PRD/files_design/01 §13)', () => {
  it('lista uma linha por instrumento, não só o nome do bloco', () => {
    renderWithQueryClient(
      <BlockDetailModal
        open
        onOpenChange={() => {}}
        block={{
          id: 'investimentos',
          name: 'Investimentos',
          value: cents(250_000_00),
          kind: 'Investment',
          items: [
            { id: 'inv-tesouro', name: 'Tesouro Direto', value: cents(150_000_00), entity: 'PF' },
            { id: 'inv-acoes', name: 'Ações XP', value: cents(100_000_00), entity: 'PF' },
          ],
        }}
      />,
    )

    expect(screen.getByText('Tesouro Direto')).toBeInTheDocument()
    expect(screen.getByText('Ações XP')).toBeInTheDocument()
    expect(screen.getByText('R$ 150.000,00')).toBeInTheDocument()
    expect(screen.getByText('R$ 100.000,00')).toBeInTheDocument()
  })

  /**
   * INVERSÃO (verificada): o corpo do modal escondia o formulário inteiro
   * quando `block.items.length > 1`, alegando em comentário que o Figma
   * 189:23 não desenhava esse caso. O frame
   * docs/figma/frames/345-252__desktop-detalhe-do-bloco-modal-sobre-inicio.xml
   * desenha EXATAMENTE esse caso e nenhum outro: o nó 189:23 se chama
   * "Conceito — Detalhe do Bloco (clique em Investimentos)" e traz as duas
   * linhas de Composição (189:32 "Tesouro Direto" + 189:37 "Ações XP") e,
   * LOGO ABAIXO delas, o bloco 189:42 "Redirecionar valor" completo — rótulos
   * 189:46 "Para onde *" e 189:50 "Valor *", botão 189:54 "Redirecionar",
   * legenda 262:2 "* Campo obrigatório" e a nota 189:55.
   *
   * Restaurando o `&& block.items.length <= 1`, os sete `expect` abaixo ficam
   * vermelhos de uma vez.
   */
  it('mostra "Redirecionar valor" no bloco agregado — o único estado que 189:23 desenha', () => {
    renderWithQueryClient(
      <BlockDetailModal
        open
        onOpenChange={() => {}}
        block={{
          id: 'investimentos',
          name: 'Investimentos',
          value: cents(250_000_00),
          kind: 'Investment',
          items: [
            {
              id: 'inv-tesouro',
              name: 'Tesouro Direto',
              value: cents(150_000_00),
              entity: 'PF',
            },
            { id: 'inv-acoes', name: 'Ações XP', value: cents(100_000_00), entity: 'PF' },
          ],
        }}
      />,
    )

    expect(screen.getByText('Redirecionar valor')).toBeInTheDocument()
    // O `*` de obrigatório faz parte do texto do <label> (189:46 "Para onde *",
    // 189:50 "Valor *"), daí a âncora no começo em vez do texto exato.
    expect(screen.getByLabelText(/^Para onde/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Valor/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Redirecionar' })).toBeInTheDocument()
    expect(screen.getByText('Campo obrigatório')).toBeInTheDocument()
    expect(
      screen.getByText(
        '"Para onde" aceita qualquer outro bloco do mapa (Contas, Dívidas, outro Investimento): mesma busca/criar de sempre.',
      ),
    ).toBeInTheDocument()
    // 189:35 e 189:40: a etiqueta de entidade fica SOB o nome do instrumento.
    expect(screen.getAllByText('PF')).toHaveLength(2)
  })

  it('mantém "Redirecionar valor" quando o bloco tem só um instrumento', () => {
    renderWithQueryClient(
      <BlockDetailModal
        open
        onOpenChange={() => {}}
        block={{
          id: 'inv-tesouro',
          name: 'Tesouro Direto',
          value: cents(150_000_00),
          kind: 'Investment',
          items: [
            { id: 'inv-tesouro', name: 'Tesouro Direto', value: cents(150_000_00), entity: 'PF' },
          ],
        }}
      />,
    )

    expect(screen.getByText('Redirecionar valor')).toBeInTheDocument()
  })
})

/**
 * O campo "Para onde" do Detalhe do Bloco. Duas fontes dizem a mesma coisa e
 * as duas citam Dívida por escrito:
 *
 * - Wireframe, docs/figma/frames/345-252…xml, nó 189:48 (placeholder):
 *   "Buscar conta, investimento ou dívida…" — e a nota 189:55 logo abaixo:
 *   «"Para onde" aceita qualquer outro bloco do mapa (Contas, Dívidas, outro
 *   Investimento): mesma busca/criar de sempre.»
 * - Mockup, nó 1002:3118 "Diálogo — Detalhe do Bloco (claro)", texto
 *   1002:3146: a mesma nota, palavra por palavra.
 * - files_design/01 §13: «"Para onde" busca qualquer outro bloco do mapa».
 *
 * INVERSÃO (verificada): `destinationItems` montava a lista só com
 * `bankAccounts` + `investments`, com um comentário declarando a exclusão de
 * Passivo — enquanto o placeholder copiado do frame continuava prometendo
 * "dívida". Medido: com um Passivo em cache, a busca devolvia
 * "Nenhum resultado encontrado."; a tela prometia um destino que ela nunca
 * ofereceria. Removendo `useLiabilities()` de `destinationItems`, o primeiro
 * teste abaixo volta a ficar vermelho.
 */
describe('Detalhe do Bloco — "Para onde" (Figma 189:48/189:55, Mockup 1002:3146)', () => {
  const INVESTIMENTOS = {
    id: 'investimentos',
    name: 'Investimentos',
    value: cents(250_000_00),
    kind: 'Investment' as const,
    items: [
      {
        id: 'inv-tesouro',
        name: 'Tesouro Direto',
        value: cents(150_000_00),
        entity: 'PF' as const,
      },
      { id: 'inv-acoes', name: 'Ações XP', value: cents(100_000_00), entity: 'PF' as const },
    ],
  }

  function renderWithCatalog() {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
        mutations: { retry: false },
      },
    })
    client.setQueryData(['bank-accounts'], {
      data: [{ id: 'acc-1', label: 'Nubank', balance: cents(420_000) }],
      meta: { total: 1 },
    })
    client.setQueryData(['investments'], {
      data: [{ id: 'inv-tesouro', name: 'Tesouro Direto', accumulatedValue: cents(150_000_00) }],
      meta: { total: 1 },
    })
    client.setQueryData(['liabilities'], {
      data: [{ id: 'liab-1', name: 'Financiamento apartamento' }],
      meta: { total: 1 },
    })

    return render(
      <QueryClientProvider client={client}>
        <BlockDetailModal open onOpenChange={() => {}} block={INVESTIMENTOS} />
      </QueryClientProvider>,
    )
  }

  it('oferece a Dívida cadastrada na busca, como o placeholder 189:48 promete', () => {
    renderWithCatalog()

    fireEvent.focus(screen.getByLabelText(/^Para onde/))

    expect(screen.getByRole('button', { name: 'Financiamento apartamento' })).toBeInTheDocument()
    // A conta e o investimento continuam lá; o Tesouro Direto some por ser a
    // própria origem (está na Composição do bloco), não por ser investimento.
    expect(screen.getByRole('button', { name: 'Nubank' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tesouro Direto' })).toBeNull()
  })

  it('recusa a Dívida no submit com mensagem explícita, sem debitar a origem', () => {
    renderWithCatalog()

    fireEvent.focus(screen.getByLabelText(/^Para onde/))
    fireEvent.click(screen.getByRole('button', { name: 'Financiamento apartamento' }))
    fireEvent.change(screen.getByLabelText(/^Valor/), { target: { value: 'R$ 1.000,00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Redirecionar' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/dívida ainda não está disponível/)
  })

  /**
   * Proporção dos dois campos. Mockup 1002:3134 "Campos": 408px divididos em
   * 256 (Para onde) + 12 de gap + 140 (Valor) — o campo de busca é ~1,8x o de
   * valor. O Wireframe 189:44 traz a mesma proporção em 396 (239 + 10 + 147).
   * O código usava `grid-cols-2`, ou seja, meio a meio.
   *
   * A checagem é estrutural (classe) porque o jsdom não carrega o CSS do
   * Tailwind: `getComputedStyle(...).gridTemplateColumns` devolve string vazia
   * aqui, então só o token aplicado é observável neste nível.
   */
  /**
   * Em 2026-09-11 esta linha deixou de ser lado a lado. O teste antigo travava a
   * proporção 256/140 do Mockup `1002:3134`, e ela caiu por medição: para o
   * campo de valor comportar "R$ 999.000.000.000,00" ele precisa de 172px
   * (148 de texto + 12 + 12 de respiro), e a única largura disponível numa
   * linha de 408 vinha da busca ao lado — espremida, "Buscar conta,
   * investimento ou dívida…" passava a truncar em "…ou d".
   */
  it('empilha "Para onde" e "Valor" — o de valor com a largura do teto de 999 bilhões', () => {
    renderWithCatalog()

    const campoValor = document.body.querySelector('[class*="--width-field-money-dialog"]')
    expect(campoValor).not.toBeNull()

    // Nenhuma grade de duas colunas sobrou nesta parte do diálogo.
    expect(document.body.querySelector('[class*="grid-redirect"]')).toBeNull()
  })
})

/**
 * INVERSÃO (verificada): o Detalhe do Consumo Livre não desenhava a linha da
 * sobra do mês anterior. O comentário do componente alegava que "no source
 * answers it" e que por isso a linha não era reproduzida — a alegação é falsa
 * quanto à EXISTÊNCIA da linha:
 *
 * - Wireframe, docs/figma/frames/345-752…xml, diálogo `192:15`: o nó `192:22`
 *   é a PRIMEIRA linha do "Histórico deste mês" (y=144, antes dos gastos em
 *   y=193/249/305) e tem layout próprio — h=33 contra h=40 das linhas de
 *   gasto, e nenhum botão "Editar" dentro dela. Os textos são literais:
 *   `192:23` "+ Sobra de Junho, adicionada ao saldo" e `192:24` "+ R$ 150,00".
 * - PRD v7 §definições (Consumo Livre), UC32 e o critério de liberação:
 *   "mostra a sobra do mês anterior como linha explícita".
 * - files_design/01 §4a (Estado C) e files_design/02: "não some silenciosamente".
 *
 * P14 (docs/PERGUNTAS-EM-ABERTO.md) pergunta se a sobra é registro guardado ou
 * valor derivado — persistência, não UI. Hoje ela é derivada.
 *
 * Removendo a linha da sobra do componente, os quatro `expect` abaixo ficam
 * vermelhos de uma vez.
 */
describe('Detalhe do Consumo Livre — sobra do mês anterior (Figma 345:752, nós 192:22/23/24)', () => {
  const CONFIG = {
    monthlyAmount: cents(500_00),
    sourceAccountId: 'acc-1',
    entity: 'PF' as const,
  }
  function renderDetail(direcionamentos: readonly unknown[] = []) {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
        mutations: { retry: false },
      },
    })
    client.setQueryData(['bank-accounts'], {
      data: [{ id: 'acc-1', label: 'Nubank', balance: cents(420_000) }],
      meta: { total: 1 },
    })
    client.setQueryData(['investments'], { data: [], meta: { total: 0 } })
    client.setQueryData(['liabilities'], { data: [], meta: { total: 0 } })
    client.setQueryData(['leftover-directions'], { data: direcionamentos, meta: { total: 0 } })
    // Junho fechou com R$ 350,00 gastos de uma verba de R$ 500,00 — a sobra é
    // de R$ 150,00, exatamente o número que o nó 192:24 desenha.
    client.setQueryData(['discretionary-spending', 'expenses', '2026-06'], {
      data: [{ id: 'e-jun', date: '2026-06-10', amount: cents(350_00), label: null }],
      meta: { total: 1 },
    })
    client.setQueryData(['discretionary-spending', 'expenses', '2026-07'], {
      data: [{ id: 'e-jul', date: '2026-07-05', amount: cents(50_00), label: null }],
      meta: { total: 1 },
    })

    return render(
      <QueryClientProvider client={client}>
        <DiscretionaryDetailModal
          open
          onOpenChange={() => {}}
          month={month('2026-07')}
          config={CONFIG}
        />
      </QueryClientProvider>,
    )
  }

  /**
   * P14 (produto, 2026-09-08) partiu esta linha em duas realidades: a sobra só
   * entra na verba se a pessoa direcionar. O teste afirmava "+ Sobra de Junho,
   * adicionada ao saldo" com o valor cheio, e isso ficou errado nas duas
   * metades — o valor não é o que entrou, e a frase promete o que não
   * aconteceu.
   *
   * A decisão de design de 2026-09-09 manteve a linha SEMPRE visível, dizendo
   * se entrou ou não: o histórico do mês conta a sobra mesmo quando ela ainda é
   * uma decisão pendente na Home.
   */
  it('a sobra ainda sem destino aparece como pendente, não como adicionada', () => {
    renderDetail()

    expect(screen.getByText('Sobra de Junho, aguardando direcionamento')).toBeInTheDocument()
    expect(screen.getByText('R$ 150,00')).toBeInTheDocument()
    expect(screen.queryByText('+ Sobra de Junho, adicionada ao saldo')).not.toBeInTheDocument()
  })

  it('files_design/01 §4a — direcionada para cá, volta a ser a linha do frame 192:22', () => {
    renderDetail([
      { id: 'dir-1', month: '2026-06', amount: 15_000, destination: { kind: 'Discretionary' } },
    ])

    expect(screen.getByText('+ Sobra de Junho, adicionada ao saldo')).toBeInTheDocument()
    expect(screen.getByText('+ R$ 150,00')).toBeInTheDocument()
  })

  it('direcionamento parcial mostra as duas linhas, que é o que aconteceu', () => {
    renderDetail([
      { id: 'dir-1', month: '2026-06', amount: 10_000, destination: { kind: 'Discretionary' } },
    ])

    expect(screen.getByText('+ Sobra de Junho, adicionada ao saldo')).toBeInTheDocument()
    expect(screen.getByText('Sobra de Junho, aguardando direcionamento')).toBeInTheDocument()
  })

  it('192:22 — a sobra é a PRIMEIRA linha do histórico e não tem "Editar"', () => {
    renderDetail()

    const rows = document.body.querySelectorAll('ul > li')
    expect(rows[0]?.textContent).toContain('Sobra de Junho')
    expect(rows[0]?.querySelector('button')).toBeNull()
    // A linha de gasto continua vindo depois, com o seu "Editar" (199:2).
    expect(rows[1]?.textContent).toContain('Dia 05/07')
  })
})

/**
 * INVERSÃO (verificada): a edição inline de um gasto do Consumo Livre montava
 * data + campo de 120px + "Salvar" numa linha só, e sem "Cancelar". O token
 * que dava esses 120px justificava-se por "narrow enough to sit next to
 * \"Salvar\" inside the fixed 44px row height" — e as duas metades da frase
 * são falsas contra o frame:
 *
 * - a linha do histórico mede 60 no Mockup (`1005:3312`), não 44; os 44 são a
 *   altura do BOTÃO "Editar" dentro dela (`1005:3316`, 71×44), e o espaço à
 *   direita da data é 155 (`1005:3314`), que não comporta 120 de campo mais
 *   um "Salvar";
 * - o único estado de edição inline que o Figma desenha, Wireframe `46:8`
 *   "Estado — Editar categoria (inline)", põe o campo ocupando a LARGURA da
 *   linha (`46:26`, 296 de 320) e manda "Cancelar" (`46:29`) e "Salvar"
 *   (`46:31`) para uma linha própria abaixo (`46:28`, y=92). A nota literal
 *   `46:33` diz: "Campo vira texto editável ali mesmo, sem popup. \"Salvar\"
 *   confirma, \"Cancelar\" reverte sem alterar."
 *
 * Restaurando o formulário de uma linha só (sem "Cancelar", com
 * `w-[var(--width-inline-money-edit)]`) e o `grid-cols-2` do bloco
 * Redirecionar, os quatro testes abaixo ficam vermelhos de uma vez —
 * verificado.
 *
 * A checagem de layout é estrutural (classe) porque o jsdom não carrega o CSS
 * do Tailwind — `getComputedStyle(...).flexDirection` devolve vazio aqui.
 */
describe('Detalhe do Consumo Livre — edição inline de um gasto (Figma 46:8, nós 46:26/46:28/46:33)', () => {
  const CONFIG = {
    monthlyAmount: cents(500_00),
    sourceAccountId: 'acc-1',
    entity: 'PF' as const,
  }

  function renderDetail() {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
        mutations: { retry: false },
      },
    })
    client.setQueryData(['bank-accounts'], {
      data: [{ id: 'acc-1', label: 'Nubank', balance: cents(420_000) }],
      meta: { total: 1 },
    })
    client.setQueryData(['investments'], { data: [], meta: { total: 0 } })
    client.setQueryData(['discretionary-spending', 'expenses', '2026-06'], {
      data: [],
      meta: { total: 0 },
    })
    client.setQueryData(['discretionary-spending', 'expenses', '2026-07'], {
      data: [{ id: 'e-jul', date: '2026-07-05', amount: cents(50_00), label: null }],
      meta: { total: 1 },
    })

    return render(
      <QueryClientProvider client={client}>
        <DiscretionaryDetailModal
          open
          onOpenChange={() => {}}
          month={month('2026-07')}
          config={CONFIG}
        />
      </QueryClientProvider>,
    )
  }

  function renderDetailWithLabel(label: string) {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
        mutations: { retry: false },
      },
    })
    client.setQueryData(['bank-accounts'], {
      data: [{ id: 'acc-1', label: 'Nubank', balance: cents(420_000) }],
      meta: { total: 1 },
    })
    client.setQueryData(['investments'], { data: [], meta: { total: 0 } })
    client.setQueryData(['discretionary-spending', 'expenses', '2026-06'], {
      data: [],
      meta: { total: 0 },
    })
    client.setQueryData(['discretionary-spending', 'expenses', '2026-07'], {
      data: [{ id: 'e-jul', date: '2026-07-05', amount: cents(50_00), label }],
      meta: { total: 1 },
    })

    return render(
      <QueryClientProvider client={client}>
        <DiscretionaryDetailModal
          open
          onOpenChange={() => {}}
          month={month('2026-07')}
          config={CONFIG}
        />
      </QueryClientProvider>,
    )
  }

  it('46:33 — "Editar" abre o formulário com "Cancelar", que reverte sem alterar', () => {
    renderDetail()

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))

    const cancelar = screen.getByRole('button', { name: 'Cancelar' })
    expect(cancelar).toBeInTheDocument()

    fireEvent.click(cancelar)

    // Voltou ao repouso: o valor do gasto está de novo em texto, com "Editar".
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull()
    expect(screen.getByText('− R$ 50,00')).toBeInTheDocument()
  })

  /**
   * INVERSÃO (verificada): o formulário de edição inline só tinha o campo de
   * Valor. Com isso o Rótulo de um gasto de Consumo Livre era inalcançável
   * pela interface inteira — `useEditDiscretionaryExpense` mandava só
   * `{ amount }` —, e a coluna `discretionary_expenses.label` nunca recebia
   * nada, apesar de existir no banco, no contrato Zod e no tipo do domínio.
   *
   * As duas fontes que mandam o campo estar aqui:
   * - Figma Wireframe, nota `164:5` "Nota — Por que \"Rótulo\" só em Consumo
   *   Livre e IR", texto `164:7`, literal: "Rótulo existe só nas abas que não
   *   têm campo de Categoria (Consumo Livre e IR), porque sem Categoria, não
   *   tem outro jeito de diferenciar lançamentos parecidos no Histórico.";
   * - files_design/03 §"Consumo Livre — widget", linha 146: "Campos editáveis:
   *   Valor, e opcionalmente Rótulo (única aba/fluxo, junto com IR, que mantém
   *   Rótulo)".
   *
   * O texto do campo é o que o Figma desenha para o Rótulo, palavra por
   * palavra, no único lugar em que ele aparece desenhado — a aba IR, nó `68:4`
   * de `262:226` (e `305:1035` no estado vazio): "Rótulo (opcional)". Sem
   * placeholder: o de `68:6` ("Ex: IR referente a 2025") é texto de IR.
   *
   * Tirando o `<Field label="Rótulo (opcional)">` do formulário, os dois
   * testes abaixo ficam vermelhos.
   */
  it('164:7 + files_design/03 §146 — "Editar" oferece o Rótulo junto do Valor', () => {
    renderDetail()

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))

    const label = screen.getByLabelText('Rótulo (opcional)')
    expect(label).toBeInTheDocument()
    expect(label.closest('form')).toBe(
      screen.getByRole('button', { name: 'Salvar' }).closest('form'),
    )
  })

  it('164:7 — o Rótulo já gravado volta preenchido ao reabrir a edição', () => {
    renderDetailWithLabel('Padaria da esquina')

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))

    expect((screen.getByLabelText('Rótulo (opcional)') as HTMLInputElement).value).toBe(
      'Padaria da esquina',
    )
  })

  it('164:7 — a linha do histórico imprime o Rótulo ao lado da data', () => {
    renderDetailWithLabel('Padaria da esquina')

    expect(screen.getByText('Dia 05/07 · Padaria da esquina')).toBeInTheDocument()
  })

  it('46:26 — o campo em edição ocupa a linha, sem a largura fixa do token antigo', () => {
    renderDetail()

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))

    const field = screen.getByLabelText('Valor do gasto de 2026-07-05')

    expect(field.className).toContain('flex-1')
    expect(field.className).not.toContain('--width-inline-money-edit')
  })

  it('46:28 — "Cancelar"/"Salvar" ficam numa linha abaixo do campo, não ao lado', () => {
    renderDetail()

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))

    const form = screen.getByRole('button', { name: 'Salvar' }).closest('form')
    expect(form?.className).toContain('flex-col')

    // O campo e os botões estão em contêineres irmãos, não no mesmo.
    const field = screen.getByLabelText('Valor do gasto de 2026-07-05')
    const buttons = screen.getByRole('button', { name: 'Salvar' }).parentElement
    expect(buttons?.contains(field)).toBe(false)
    expect(buttons?.parentElement).toBe(form)
  })

  /**
   * Mockup `1005:3332` "Campos" no Diálogo `1005:3303`: 348 = Campo "Para
   * onde" `1005:3333` (216) + 12 de gap + Campo "Valor" `1005:3337` (120).
   * O código usava `grid-cols-2`, ou seja, meio a meio — e era desse mesmo
   * nó `1005:3337` que vinham, sem crédito, os 120px do token antigo.
   */
  /**
   * Mesma mudança de 2026-09-11 do Detalhe do Bloco, e aqui era mais apertado:
   * a linha tem 348, e o campo de valor tinha 120. Empilhar é o que deixa ele
   * chegar aos 180 que o teto de 999 bilhões exige sem cortar a busca.
   */
  it('empilha "Para onde" e "Valor" — o de valor com a largura do teto de 999 bilhões', () => {
    renderDetail()

    const campoValor = document.body.querySelector('[class*="--width-field-money-dialog"]')
    expect(campoValor).not.toBeNull()
    expect(document.body.querySelector('[class*="grid-redirect"]')).toBeNull()
  })
})

/**
 * A seta do back-link é o COMPONENTE `icon/arrow-left`, não o caractere "←".
 * Medido na Mockup pelo MCP — o frame "Link" separa os dois nós:
 *
 *   <frame id="1022:3025" name="Link" width="168" height="20">
 *     <instance id="1022:3026" name="icon/arrow-left" x="0" width="20" height="20" />
 *     <text id="1022:3028" name="Onde Está Meu Dinheiro" x="24" width="144" />
 *   </frame>
 *
 * O Wireframe (`189:24`) escreve o glifo dentro do próprio texto, mas ali TODO
 * ícone é glifo — é rascunho, e a Mockup é a camada visual vigente (ADR-0015
 * §1). Mesmo defeito já corrigido na barra lateral e no seletor de mês; este
 * era o terceiro componente que ainda usava glifo solto.
 */
describe('back-link dos modais sobre Início — Mockup 1022:3025/1022:3026', () => {
  it('usa o ícone icon/arrow-left, não o caractere "←" solto', () => {
    renderWithQueryClient(
      <BlockDetailModal
        open
        onOpenChange={() => {}}
        block={{
          id: 'acc-1',
          name: 'Nubank',
          value: cents(420_000),
          kind: 'BankAccount',
          items: [{ id: 'acc-1', name: 'Nubank', value: cents(420_000), entity: 'PF' }],
        }}
      />,
    )

    const back = screen.getByRole('button', { name: 'Onde Está Meu Dinheiro' })
    expect(back.textContent).not.toContain('←')
    expect(back.querySelector('svg')).not.toBeNull()
  })
})

/**
 * files_design/03, regra fechada em 2026-09-11: **a legenda "* Campo
 * obrigatório" aparece uma vez por tela ou diálogo que tenha campo
 * obrigatório, no fim da área de campos — e nunca em edição inline dentro de
 * uma lista**, que não tem rodapé e repetiria a frase em cada linha.
 *
 * A regra precisou ser ESCOLHIDA, não descoberta: das 36 telas com campo
 * obrigatório, 28 formulários principais traziam a legenda e 2 não, e as 5
 * edições inline nunca traziam. Detalhe do Bloco e Detalhe do Consumo Livre
 * têm estrutura idêntica — lista em cima, bloco "Redirecionar" embaixo — e
 * discordavam entre si.
 *
 * Os dois testes abaixo travam os dois lugares que estavam fora da regra nos
 * DOIS lados, Figma e código.
 */
describe('A legenda de campo obrigatório (files_design/03)', () => {
  it('"Gastei um valor" mostra a legenda', () => {
    renderWithQueryClient(
      <DiscretionaryExpenseModal open onOpenChange={() => {}} month={month('2026-07')} />,
    )
    expect(screen.getByText(/Campo obrigatório/)).toBeInTheDocument()
  })

  it('"Direcionar valor" da sobra mostra a legenda', () => {
    renderWithQueryClient(
      <DirecionarSobraModal
        open
        onOpenChange={() => {}}
        selection={{ month: month('2026-07'), remaining: cents(350_00) }}
      />,
    )
    expect(screen.getByText(/Campo obrigatório/)).toBeInTheDocument()
  })
})

/**
 * ADR-0017 §2 — "Redirecionar valor" é UMA requisição.
 *
 * Este teste existe porque o defeito que a ADR fecha era invisível a todos os
 * outros deste arquivo: eles conferem que o formulário está DESENHADO, e o
 * formulário sempre esteve certo. O que estava errado era o submit — um `PATCH`
 * por lado do movimento, com o comentário admitindo que "se uma falhar as
 * anteriores já aconteceram". Debitava a conta, falhava ao creditar o
 * investimento, e o dinheiro sumia.
 *
 * Por isso a asserção é sobre a CHAMADA: o número de requisições é a diferença
 * entre um movimento atômico e dois movimentos independentes que só parecem um.
 */
describe('Detalhe do Bloco — "Redirecionar valor" (ADR-0017 §2)', () => {
  it('manda UMA requisição, para /transfers, com as duas pernas do movimento', async () => {
    const user = userEvent.setup()
    const escritas: { url: string; body: unknown }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        const metodo = String(init?.method ?? 'GET')
        if (metodo !== 'GET') {
          escritas.push({ url: String(url), body: JSON.parse(String(init?.body ?? 'null')) })
        }
        return Promise.resolve(
          new Response(JSON.stringify({ data: [], applied: 2 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        )
      }),
    )

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    // O destino tem de existir na busca para a pessoa poder escolhê-lo.
    client.setQueryData(['bank-accounts'], { data: [], meta: { total: 0 } })
    client.setQueryData(['liabilities'], { data: [], meta: { total: 0 } })
    client.setQueryData(['investments'], {
      data: [
        {
          id: 'inv-sintetico',
          name: 'Investimento Sintético',
          entity: 'PF',
          accumulatedValue: 2_200_000,
        },
      ],
      meta: { total: 1 },
    })

    render(
      <QueryClientProvider client={client}>
        <BlockDetailModal
          open
          onOpenChange={() => {}}
          block={{
            id: 'conta-sintetica',
            name: 'Conta Sintética',
            value: cents(50_000_00),
            kind: 'BankAccount',
            items: [
              {
                id: 'conta-sintetica',
                name: 'Conta Sintética',
                value: cents(50_000_00),
                entity: 'PF',
              },
            ],
          }}
        />
      </QueryClientProvider>,
    )

    await user.click(screen.getByLabelText(/^Para onde/))
    await user.click(await screen.findByText('Investimento Sintético'))
    await user.type(screen.getByLabelText(/^Valor/), '1000000')
    await user.click(screen.getByRole('button', { name: 'Redirecionar' }))

    await vi.waitFor(() => expect(escritas).toHaveLength(1))
    expect(escritas[0]!.url).toContain('/transfers')
    expect(escritas[0]!.body).toMatchObject({
      sources: [
        { position: { kind: 'BankAccount', bankAccountId: 'conta-sintetica' }, amount: 1_000_000 },
      ],
      destination: { kind: 'Investment', investmentId: 'inv-sintetico' },
      amount: 1_000_000,
    })
  })
})
