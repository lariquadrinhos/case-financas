import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PlanoDeContasScreen } from './plano-de-contas'
import type { Category, StatementBlock } from '../types'

/**
 * Figma 44:2 desenha Editar/Descartar em cada categoria, e o próprio frame
 * traz a nota de comportamento (nó 44:88): "Cada categoria tem
 * Editar/Descartar (mesmo padrão do resto do produto)". Esta tela mostra a
 * mesma linha do Onboarding 1 porque files_design/01 §10 diz que ela
 * "reaproveita o conteúdo já validado no onboarding".
 *
 * "Descartar" **arquiva**, não exclui — o que o PRD §4/§7 proíbe é o DELETE,
 * que nunca existiu. Ver o comentário de `useArchiveCategory`
 * (../chart-of-accounts) para as fontes completas.
 */

const block: StatementBlock = {
  id: 'despesas-pessoais',
  name: 'Despesas Pessoais/Consumo',
  order: 5,
  effect: 'Subtract',
  belowTheLine: false,
  acceptsUserCategories: true,
  statementLabel: null,
}

const category: Category = {
  id: 'alimentacao',
  blockId: 'despesas-pessoais',
  name: 'Alimentação',
  isSystem: false,
  suggestedClassification: null,
  archived: false,
  isPassiveIncome: false,
}

/**
 * Os dois blocos cujo rótulo mudava de tela pra tela, e que por isso provam a
 * regra do src/domain/GLOSSARY.md: «`statementLabel` — "D&A" na cascata vs. o
 * nome completo no Plano de Contas». Medido nos frames, texto literal:
 *
 * | Bloco | DRE (cascata) | Plano de Contas / Onboarding 1 |
 * |---|---|---|
 * | 3 | Custo dos Serviços/Produtos | Custo dos Serviços/Produtos |
 * | 6 | D&A                        | Depreciação & Amortização (D&A) |
 *
 * (conferido nos 4 frames de Plano de Contas da página Mockup — inclusive os
 * dois estados novos, bloco aberto e editar categoria — e no
 * "Desktop — DRE (claro)"; os 10 títulos são idênticos nos quatro.)
 *
 * Logo `statementLabel` significa uma coisa só: o rótulo ENCURTADO da cascata
 * do DRE. Esta tela usa `name`. O bloco 3 não precisa mais de
 * `statementLabel`, porque as duas telas escrevem o mesmo texto; a sigla
 * "(CSV)" é abreviação de prosa do PRD (§361) e não aparece em tela nenhuma.
 */
const csvBlock: StatementBlock = {
  id: 'csv',
  name: 'Custo dos Serviços/Produtos',
  order: 3,
  effect: 'Subtract',
  belowTheLine: false,
  acceptsUserCategories: true,
  statementLabel: null,
}

const daBlock: StatementBlock = {
  id: 'depreciacao-e-amortizacao',
  name: 'Depreciação & Amortização (D&A)',
  order: 6,
  effect: 'Subtract',
  belowTheLine: false,
  acceptsUserCategories: false,
  statementLabel: 'D&A',
}

/**
 * "Consumo Livre" é a única categoria `isSystem` (src/domain/chart-of-accounts
 * /types.ts:279). Entra no mock justamente para provar que ela NÃO é listada.
 */
const systemCategory: Category = {
  id: 'consumo-livre',
  blockId: 'despesas-pessoais',
  name: 'Consumo Livre',
  isSystem: true,
  suggestedClassification: null,
  archived: false,
  isPassiveIncome: false,
}

vi.mock('../chart-of-accounts', () => ({
  useStatementBlocks: () => ({
    isLoading: false,
    isError: false,
    data: { data: [block, csvBlock, daBlock] },
    refetch: vi.fn(),
  }),
  categories: {
    useList: () => ({
      isLoading: false,
      isError: false,
      data: { data: [category, systemCategory] },
      refetch: vi.fn(),
    }),
    usePatch: () => ({ mutate: vi.fn(), isPending: false }),
    useCreate: () => ({ mutate: vi.fn(), isPending: false }),
  },
  useArchiveCategory: () => ({ mutate: vi.fn(), isPending: false }),
}))

function renderWithQueryClient(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('PlanoDeContasScreen (pós-onboarding) — Figma 44:2/44:88', () => {
  it('mostra Editar E Descartar numa categoria comum, dentro do bloco expandido', async () => {
    renderWithQueryClient(<PlanoDeContasScreen />)

    await userEvent.click(screen.getByText('5. Despesas Pessoais/Consumo'))

    expect(await screen.findByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeInTheDocument()
  })

  /**
   * O botão de criar categoria fica INLINE com o Campo, na mesma linha
   * (Wireframe 44:2, nós 121:3 "Nome da categoria" e 121:5 "+ Criar
   * categoria"). No Wireframe os dois têm o mesmo topo e a mesma altura (35),
   * mas ali TODO controle é o mesmo traço cinza de 35px — o frame não decide
   * altura de componente, só posição.
   *
   * Quem decide é o Style guide, e ele dá duas alturas diferentes: Botão 44
   * (458:26 → símbolos 458:2..458:24, 12 de 12 medem 72×44) e Caixa do Campo
   * 40 (símbolo 460:3 → frame 460:5, 240×40). Por ADR-0015 §1 o Style guide
   * ganha da medição, então o par usa 44 + 40 e o `items-end` do contêiner
   * alinha a base.
   *
   * O que este teste afirmava antes: `h-[var(--height-field)]` no botão —
   * 40px, uma altura de botão que NENHUM frame do arquivo desenha. Era teste
   * verde congelando uma invenção.
   */
  it('Figma 458:2..458:24 — o botão de criar categoria usa a altura de Botão (44), não a do Campo', async () => {
    renderWithQueryClient(<PlanoDeContasScreen />)

    await userEvent.click(screen.getByText('5. Despesas Pessoais/Consumo'))

    const button = await screen.findByRole('button', { name: '+ Criar categoria' })
    expect(button.className).toContain('h-[var(--height-button)]')
    expect(button.className).not.toContain('h-[var(--height-field)]')
    expect(button.className).not.toContain('h-[var(--height-control)]')
  })

  /**
   * Wireframe 44:2, nó 121:2 — a linha de criar categoria, medida no XML
   * (docs/figma/frames/44-2__onboarding-1-bloco-de-categoria-expandido-exemplo.xml):
   * a linha mede 572 e é partida em duas colunas IGUAIS de 282 com 8 de vão
   * (121:3 em x=0 w=282; 202:16 em x=290 w=282), e dentro da segunda coluna o
   * botão 121:5 (x=153, w=129) termina em 572 — encostado na borda direita da
   * linha. Os textos são literais: 121:4 "Nome da categoria *" e 121:6
   * "+ Criar categoria".
   *
   * O que estava aqui antes: rótulo "Nova categoria" com `required={false}`,
   * botão "+ Adicionar categoria" e um `--width-inline-category-edit: 280px`
   * justificado por "caber 'Despesas Administrativas' sem quebrar linha" —
   * nenhum dos três existe no arquivo Figma. "Despesas Administrativas" é
   * título do bloco 4 (nó 44:28), não conteúdo desse campo.
   */
  it('Figma 44:2 nó 121:6 — o botão de criar categoria diz "+ Criar categoria"', async () => {
    renderWithQueryClient(<PlanoDeContasScreen />)

    await userEvent.click(screen.getByText('5. Despesas Pessoais/Consumo'))

    expect(await screen.findByRole('button', { name: '+ Criar categoria' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Adicionar categoria' })).not.toBeInTheDocument()
  })

  it('Figma 44:2 nó 121:4 — o campo é "Nome da categoria *" e é obrigatório', async () => {
    renderWithQueryClient(<PlanoDeContasScreen />)

    await userEvent.click(screen.getByText('5. Despesas Pessoais/Consumo'))

    const campo = await screen.findByLabelText('Nome da categoria *')
    expect(campo).toHaveAttribute('aria-required', 'true')
    expect(screen.queryByText('Nova categoria')).not.toBeInTheDocument()
  })

  it('Figma 44:2 nó 121:2 — duas colunas iguais (282+8+282), botão na borda direita', async () => {
    renderWithQueryClient(<PlanoDeContasScreen />)

    await userEvent.click(screen.getByText('5. Despesas Pessoais/Consumo'))

    const button = await screen.findByRole('button', { name: '+ Criar categoria' })
    const row = button.closest('form')
    expect(row).not.toBeNull()
    expect(row?.className).toContain('grid-cols-2')
    expect(row?.className).toContain('gap-8')
    expect(button.className).toContain('justify-self-end')
    // O 280px inventado não volta por nenhuma porta.
    expect(row?.innerHTML).not.toContain('--width-inline-category-edit')
  })

  /**
   * Decisão de produto de 2026-09-07: "Consumo Livre" sai da lista do Plano de
   * Contas e passa a ser tratada como área de consumo isolada, com widget
   * próprio na Home (files_design/01 §4a).
   *
   * Resolve na raiz a contradição do frame 44:2: a nota 44:88 diz que "cada
   * categoria tem Editar/Descartar", mas o contrato da API proíbe renomear ou
   * arquivar a de sistema, porque o widget sempre lança nela. Fora da lista,
   * a regra do frame vale sem exceção para tudo que sobra.
   */
  it('não lista "Consumo Livre" — é área isolada, não linha do bloco de despesas', async () => {
    renderWithQueryClient(<PlanoDeContasScreen />)

    await userEvent.click(screen.getByText('5. Despesas Pessoais/Consumo'))

    expect(await screen.findByText('Alimentação')).toBeInTheDocument()
    expect(screen.queryByText('Consumo Livre')).not.toBeInTheDocument()
    // O rótulo que marcava a exceção também some junto.
    expect(screen.queryByText('Categoria fixa do sistema')).not.toBeInTheDocument()
  })

  it('mostra o bloco 3 sem a sigla "(CSV)", que não aparece em frame nenhum', async () => {
    renderWithQueryClient(<PlanoDeContasScreen />)

    expect(await screen.findByText('3. Custo dos Serviços/Produtos')).toBeInTheDocument()
    expect(screen.queryByText(/\(CSV\)/)).not.toBeInTheDocument()
  })

  /**
   * O contra-exemplo que a regra antiga (`statementLabel ?? name`) errava: a
   * cascata do DRE encurta o bloco 6 pra "D&A", mas os 4 frames de Plano de
   * Contas escrevem "Depreciação & Amortização (D&A)" por extenso. Esta tela
   * não é a cascata.
   */
  it('escreve o bloco 6 por extenso, como o Figma — não o "D&A" da cascata do DRE', async () => {
    renderWithQueryClient(<PlanoDeContasScreen />)

    expect(await screen.findByText('6. Depreciação & Amortização (D&A)')).toBeInTheDocument()
    expect(screen.queryByText('6. D&A')).not.toBeInTheDocument()
  })
})

/**
 * O estado de edição inline é desenhado em dois lugares. O COMPORTAMENTO vem
 * do Wireframe 46:8 "Estado — Editar categoria (inline)", cuja nota (nó 46:33)
 * diz literalmente: «Campo vira texto editável ali mesmo, sem popup. "Salvar"
 * confirma, "Cancelar" reverte sem alterar.» A GEOMETRIA vem do Mockup
 * `Categoria em edição` (1301:5237), desenhado com o time de design em
 * 2026-09-08 — e onde os dois discordam manda o Mockup (ADR-0015).
 *
 * Esta tela reaproveita a linha do Onboarding 1 (files_design/01 §10), logo os
 * mesmos fatos valem aqui.
 */
describe('PlanoDeContasScreen — edição inline de categoria — Figma 46:8 + Mockup 1301:5237', () => {
  async function enterEditMode() {
    const user = userEvent.setup()
    renderWithQueryClient(<PlanoDeContasScreen />)
    await user.click(screen.getByText('5. Despesas Pessoais/Consumo'))
    await user.click(await screen.findByRole('button', { name: 'Editar' }))
  }

  /** 46:29 (Cancelar, x=0) vem ANTES de 46:31 (Salvar, x=78). */
  it('desenha Cancelar antes de Salvar', async () => {
    await enterEditMode()

    const cancelar = screen.getByRole('button', { name: 'Cancelar' })
    const salvar = screen.getByRole('button', { name: 'Salvar' })

    expect(cancelar.compareDocumentPosition(salvar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  /**
   * 1301:5237 empilha três irmãos — `Campo`, "Conta como renda passiva" e
   * `Ações` —, mesma leitura do 46:25/46:28: o campo não divide a linha com os
   * botões.
   */
  it('põe o campo numa linha e os botões noutra', async () => {
    await enterEditMode()

    const formulario = screen.getByRole('group', { name: 'Editar categoria Alimentação' })
    const campo = within(formulario).getByRole('textbox')
    const cancelar = screen.getByRole('button', { name: 'Cancelar' })
    const salvar = screen.getByRole('button', { name: 'Salvar' })

    expect(campo.parentElement).not.toContainElement(cancelar)
    expect(campo.parentElement).not.toContainElement(salvar)
  })

  /**
   * 1301:5237 › `Campo` — o Mockup desenha o rótulo VISÍVEL "Nome da categoria
   * *" acima da caixa; o Wireframe 46:26 não tinha rótulo nenhum e o código
   * supria com um aria-label. Como a linha de criar categoria logo abaixo usa
   * o MESMO rótulo, o formulário é um grupo nomeado — é o que separa as duas
   * caixas para quem navega por leitor de tela.
   */
  it('Mockup 1301:5237 — o campo tem o rótulo visível "Nome da categoria *"', async () => {
    await enterEditMode()

    const formulario = screen.getByRole('group', { name: 'Editar categoria Alimentação' })
    expect(within(formulario).getByLabelText('Nome da categoria *')).toHaveValue('Alimentação')
  })

  /**
   * 1301:5237 › `Ações` tem `primaryAxisAlignItems: 'MAX'` — os botões terminam
   * na borda direita do formulário, não na esquerda como o Wireframe 46:28
   * desenhava. O Wireframe empilha tudo na margem esquerda porque não tem
   * camada visual; o Mockup é quem decide geometria (ADR-0015).
   */
  it('Mockup 1301:5237 — alinha Cancelar e Salvar à direita', async () => {
    await enterEditMode()

    const linha = screen.getByRole('button', { name: 'Salvar' }).parentElement!
    expect(linha).toHaveClass('justify-end')
  })

  /**
   * 46:29 e 46:31 têm a MESMA caixa de 25px, idêntica à de "Editar" (46:16) e
   * "Descartar" (46:18) do estado normal: o desenho não distingue ênfase
   * entre os dois.
   */
  it('dá o mesmo peso visual a Cancelar e Salvar', async () => {
    await enterEditMode()

    const cancelar = screen.getByRole('button', { name: 'Cancelar' })
    const salvar = screen.getByRole('button', { name: 'Salvar' })

    expect(salvar.className).toBe(cancelar.className)
  })
})
