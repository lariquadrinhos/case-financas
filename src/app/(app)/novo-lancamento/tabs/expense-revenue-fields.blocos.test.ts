import { describe, expect, it } from 'vitest'
import { BLOCK_IDS, DEFAULT_BLOCKS } from '@/domain/chart-of-accounts'

/**
 * P34 (produto, 2026-09-08) — quais blocos o Novo Lançamento oferece ao criar
 * uma categoria de Despesa.
 *
 * A derivação anterior escolhia o bloco sozinha, a partir da entidade, e a
 * premissa era falsa: os blocos não se dividem por PF/PJ. Na planilha de
 * referência o bloco 4 é só custo fixo de casa e o custo da PJ mora no bloco 3.
 * Agora a pessoa escolhe — mas não entre todos.
 *
 * DUAS ausências, as duas por correção e não por gosto:
 *
 *  - **D&A** não aceita categoria (`acceptsUserCategories: false`); oferecê-lo
 *    seria oferecer um caminho que `createCategory` recusa com
 *    `chart_of_accounts.block_refuses_categories`.
 *  - **Receita Bruta** SOMA (`effect: 'Add'`) e uma Despesa contribui negativo
 *    (`effectInView`). Uma categoria de despesa ali reduziria a receita bruta —
 *    número sem sentido, e irreversível, porque categoria não muda de bloco.
 *
 * O filtro é pelo EFEITO do bloco, não pelo nome: um bloco de receita novo
 * ficaria de fora sozinho.
 */
const oferecidosParaDespesa = DEFAULT_BLOCKS.filter(
  (block) => block.acceptsUserCategories && block.effect !== 'Add',
)

describe('Novo Lançamento — blocos oferecidos ao criar categoria de Despesa (P34)', () => {
  it('não oferece Receita Bruta: despesa ali reduziria a receita', () => {
    expect(oferecidosParaDespesa.map((b) => b.id)).not.toContain(BLOCK_IDS.grossRevenue)
  })

  it('não oferece D&A: é o único bloco que recusa categoria', () => {
    expect(oferecidosParaDespesa.map((b) => b.id)).not.toContain(
      BLOCK_IDS.depreciationAndAmortization,
    )
  })

  it('oferece os oito restantes, do 2 ao 10', () => {
    expect(oferecidosParaDespesa.map((b) => b.order)).toEqual([2, 3, 4, 5, 7, 8, 9, 10])
  })
})
