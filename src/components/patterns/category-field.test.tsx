import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CategoryField, type CategoryFieldCategory } from './category-field'

/**
 * Fidelidade do campo Categoria ao Wireframe `47:2` "Estado — Buscar/Criar
 * Categoria (expandido)", o ÚNICO frame do arquivo que desenha este estado
 * aberto. O painel ① (`47:4`) é literalmente o campo do Novo Lançamento
 * (rótulo "Categoria *" `122:3`, placeholder "Buscar ou criar categoria…"
 * `122:5` — os mesmos `6:66`/`6:68` de `262:873` "Desktop — Novo Lançamento
 * (aba Despesa)"), então o frame está falando DESTE campo.
 *
 * INVERSÃO VERIFICADA: com o código de `git show HEAD:src/components/patterns/
 * category-field.tsx` os quatro testes ficam vermelhos — clicar em criar abria
 * um painel inventado ("Em qual bloco do Plano de Contas … fica?" + um
 * `<Select aria-label="Bloco">` + Criar/Cancelar), o rótulo era
 * `+ Criar categoria "pet"` sem o "neste bloco" de `47:26`, a dica `84:2` não
 * existia e o token `--width-block-picker` vestia o Select inventado.
 */

// Radix Popover mede o gatilho ao abrir; o jsdom não tem ResizeObserver.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

const BLOCK = { id: 'despesas-pessoais', name: 'Despesas Pessoais/Consumo' }

// Fixture sintética (CLAUDE.md §9). Os dois nomes do bloco são os mesmos que
// `84:2` cita: "Categorias parecidas neste bloco: Alimentação, Automóvel".
const CATEGORIES: readonly CategoryFieldCategory[] = [
  {
    id: 'alimentacao',
    name: 'Alimentação',
    blockId: BLOCK.id,
    isSystem: false,
    archived: false,
    suggestedClassification: null,
  },
  {
    id: 'automovel',
    name: 'Automóvel',
    blockId: BLOCK.id,
    isSystem: false,
    archived: false,
    suggestedClassification: null,
  },
  {
    id: 'salario',
    name: 'Salário',
    blockId: 'receita-bruta',
    isSystem: false,
    archived: false,
    suggestedClassification: null,
  },
]

function renderField(
  overrides: {
    onCreateCategory?: (name: string, blockId: string) => Promise<CategoryFieldCategory | null>
    onSelectCategory?: (category: CategoryFieldCategory) => void
  } = {},
) {
  const onCreateCategory =
    overrides.onCreateCategory ??
    vi.fn(async () => ({
      id: 'pet',
      name: 'pet',
      blockId: BLOCK.id,
      isSystem: false,
      archived: false,
      suggestedClassification: null,
    }))
  const onSelectCategory = overrides.onSelectCategory ?? vi.fn()

  render(
    <CategoryField
      categories={CATEGORIES}
      block={BLOCK}
      value=""
      onSelectCategory={onSelectCategory}
      onCreateCategory={onCreateCategory}
    />,
  )

  const input = screen.getByPlaceholderText('Buscar ou criar categoria…')
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'pet' } })
  return { onCreateCategory, onSelectCategory }
}

describe('CategoryField — Figma 47:2 (Wireframe)', () => {
  // Estes testes levavam 11-13s cada até a P40 ser medida em 2026-09-09: a
  // causa era a recursão de `:modal` entre @floating-ui e nwsapi, cortada em
  // vitest.setup.ts — não a simulação de ponteiro, como se supunha aqui.

  it('Figma 47:2 §47:26 — o rótulo de criar é "+ Criar categoria \\"pet\\" neste bloco"', async () => {
    renderField()

    expect(
      await screen.findByRole('button', { name: /\+ Criar categoria "pet" neste bloco/ }),
    ).toBeInTheDocument()
  })

  it('Figma 47:2 §47:27 — criar confirma direto, sem seletor de bloco', async () => {
    const { onCreateCategory, onSelectCategory } = renderField()

    fireEvent.click(
      await screen.findByRole('button', { name: /\+ Criar categoria "pet" neste bloco/ }),
    )

    // "Confirma direto: bloco já é o de onde a pessoa clicou … sem precisar
    // escolher de novo." (47:27) — nenhum passo intermediário existe.
    await waitFor(() => expect(onCreateCategory).toHaveBeenCalledWith('pet', BLOCK.id), {
      timeout: 10_000,
    })
    expect(screen.queryByLabelText('Bloco')).toBeNull()
    expect(screen.queryByText(/Em qual bloco do Plano de Contas/)).toBeNull()
    expect(screen.queryByPlaceholderText('Selecionar bloco…')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull()
    await waitFor(() => expect(onSelectCategory).toHaveBeenCalled(), { timeout: 10_000 })
  })

  it('Figma 47:2 §84:2 — a linha de criação lembra as categorias parecidas neste bloco', async () => {
    renderField()

    // `84:2`, literal: só as do bloco em contexto ("Salário" é de outro bloco).
    expect(
      await screen.findByText('Categorias parecidas neste bloco: Alimentação, Automóvel'),
    ).toBeInTheDocument()
  })

  it('Figma 47:2 §47:21 e §47:23 — cabeçalho e linha de lista vazia são os do frame', async () => {
    renderField()

    expect(await screen.findByText('CATEGORIAS EXISTENTES')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma categoria encontrada')).toBeInTheDocument()
  })

  it('Figma 47:2 — nenhum token veste um seletor de bloco que o frame não desenha', () => {
    const css = readFileSync(path.resolve(__dirname, '../../styles/tokens.css'), 'utf8')

    // A declaração some; a lápide em comentário fica, como manda a convenção
    // do próprio arquivo ("Aqui estava …", com o motivo e o nó do frame).
    expect(css).not.toMatch(/^\s*--width-block-picker:/m)

    // E ninguém mais o veste: era o único uso do token em todo o repositório.
    const field = readFileSync(path.resolve(__dirname, 'category-field.tsx'), 'utf8')
    expect(field).not.toContain('var(--width-block-picker)')
  })
})

/**
 * P34 (produto, 2026-09-08) — no Novo Lançamento o bloco NÃO está em contexto,
 * e passa a ser perguntado.
 *
 * A derivação anterior (Despesa PJ → Despesas Administrativas, PF → Despesas
 * Pessoais/Consumo) foi descartada porque a premissa era falsa: os blocos não
 * se dividem por entidade. Na planilha de referência o bloco 4 é só custo fixo
 * de casa e o custo da PJ mora no bloco 3. E o palpite não é só impreciso: é
 * irreversível, porque `categoryPatchSchema` não aceita `blockId`.
 *
 * Desenhado no Mockup "Desktop — Novo Lançamento (criar categoria: escolher
 * bloco)", claro e escuro, reusando a anatomia de lista do próprio dropdown.
 */
describe('CategoryField — escolher bloco quando não há bloco em contexto (P34)', () => {
  const BLOCOS = [
    { id: 'receita-bruta', name: '1. Receita Bruta' },
    { id: 'despesas-pessoais', name: '5. Despesas Pessoais/Consumo' },
  ]

  function renderSemBloco() {
    const onCreateCategory = vi.fn(async () => ({
      id: 'uber',
      name: 'Uber',
      blockId: 'despesas-pessoais',
      isSystem: false,
      archived: false,
      suggestedClassification: null,
    }))
    render(
      <CategoryField
        categories={CATEGORIES}
        block={BLOCK}
        blocksToChoose={BLOCOS}
        value=""
        onSelectCategory={vi.fn()}
        onCreateCategory={onCreateCategory}
      />,
    )
    const input = screen.getByPlaceholderText('Buscar ou criar categoria…')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Uber' } })
    return { onCreateCategory }
  }

  it('a linha de criação não diz "neste bloco", porque não existe este bloco aqui', async () => {
    renderSemBloco()

    expect(await screen.findByText('+ Criar categoria "Uber"')).toBeInTheDocument()
    expect(screen.queryByText('+ Criar categoria "Uber" neste bloco')).not.toBeInTheDocument()
  }, 40_000)

  it('criar abre o passo de escolher bloco, e avisa que a escolha é permanente', async () => {
    renderSemBloco()

    fireEvent.click(await screen.findByText('+ Criar categoria "Uber"'))

    expect(await screen.findByText('ESCOLHA O BLOCO')).toBeInTheDocument()
    expect(
      screen.getByText(/Onde "Uber" vai ficar no seu Plano de Contas\. Não dá pra mudar depois\./),
    ).toBeInTheDocument()
  }, 40_000)

  it('escolher o bloco é o que cria a categoria, e cria NAQUELE bloco', async () => {
    const { onCreateCategory } = renderSemBloco()

    fireEvent.click(await screen.findByText('+ Criar categoria "Uber"'))
    fireEvent.click(await screen.findByText('5. Despesas Pessoais/Consumo'))

    await waitFor(() => expect(onCreateCategory).toHaveBeenCalledWith('Uber', 'despesas-pessoais'))
  }, 40_000)

  it('sem escolher o bloco, nada é criado', async () => {
    const { onCreateCategory } = renderSemBloco()

    fireEvent.click(await screen.findByText('+ Criar categoria "Uber"'))
    await screen.findByText('ESCOLHA O BLOCO')

    expect(onCreateCategory).not.toHaveBeenCalled()
  }, 40_000)
})
