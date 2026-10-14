import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { cents, month } from '@/domain/core'
import { ExpensesByCategoryCard } from './expenses-by-category-card'

/**
 * P32, validação das mudanças do doc07 sobre os docs 01-03: o teto de seis
 * blocos com "Outras" a partir do sétimo (files_design/07, "Em Despesas por
 * Categoria"; files_design/08 §2.7) vale para ESTE card, e "Outras" é um bloco
 * como os outros — clicável, com o detalhe do que ele soma.
 */
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

// O <Treemap> MEDE a largura do contêiner, e no jsdom toda medida é zero — sem
// largura ele não desenha bloco nenhum e o teste não teria o que clicar.
vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
  width: 1000,
  height: 210,
  top: 0,
  left: 0,
  right: 1000,
  bottom: 210,
  x: 0,
  y: 0,
  toJSON: () => ({}),
})

const CATEGORIES = Array.from({ length: 8 }, (_, index) => ({
  id: `cat-${index + 1}`,
  name: `Categoria ${index + 1}`,
  blockId: 'blk-1',
  archived: false,
}))

vi.mock('../_lib/queries', () => ({
  useCategories: () => ({ data: { data: CATEGORIES }, isPending: false }),
  useMonthlyExpenses: () => ({
    data: {
      data: CATEGORIES.map((category, index) => ({
        id: `ent-${index + 1}`,
        kind: 'Expense' as const,
        categoryId: category.id,
        amount: cents((800 - index * 100) * 100),
      })),
    },
    isPending: false,
  }),
  useDiscretionarySpendingConfig: () => ({ data: null, isPending: false }),
}))

describe('Despesas por Categoria', () => {
  it('files_design/08 §2.7 — mostra seis blocos, o sexto sendo "Outras" com a soma do excedente', () => {
    render(<ExpensesByCategoryCard month={month('2026-07')} />)
    const blocks = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-label'))
    expect(blocks).toHaveLength(6)
    // 300 (Categoria 6) + 200 (7) + 100 (8) = 600
    expect(screen.getByRole('button', { name: /^Outras, / })).toHaveAccessibleName(
      /^Outras, R\$.600$/,
    )
  })

  it('files_design/01 §13 — clicar em "Outras" abre o detalhe do que ela soma, como qualquer outro bloco', async () => {
    const user = userEvent.setup()
    render(<ExpensesByCategoryCard month={month('2026-07')} />)
    await user.click(screen.getByRole('button', { name: /^Outras, / }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleName('Outras')
    // As três categorias que não ganharam bloco próprio, e só elas. A busca é
    // DENTRO do diálogo: "Categoria 5" continua na tela atrás dele, como bloco.
    const detail = within(dialog)
    expect(detail.getByText('Categoria 6')).toBeInTheDocument()
    expect(detail.getByText('Categoria 8')).toBeInTheDocument()
    expect(detail.queryByText('Categoria 5')).not.toBeInTheDocument()
  })
})
