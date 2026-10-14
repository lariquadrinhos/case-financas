import { describe, expect, it } from 'vitest'

import {
  BLOCK_IDS,
  DEFAULT_BLOCKS,
  DEFAULT_CATEGORIES,
  DISCRETIONARY_CATEGORY_ID,
  LABEL_CASCADE_PREFIX,
} from './types'

describe('DEFAULT_BLOCKS', () => {
  it('holds the ten reference blocks in the PRD order', () => {
    expect(DEFAULT_BLOCKS.map((block) => block.name)).toEqual([
      'Receita Bruta',
      'Deduções da Receita',
      'Custo dos Serviços/Produtos',
      'Despesas Administrativas',
      'Despesas Pessoais/Consumo',
      'Depreciação & Amortização (D&A)',
      'Resultado Não Operacional',
      'Resultado Financeiro',
      'Impostos sobre o Lucro',
      'Destinação do Lucro',
    ])
    expect(DEFAULT_BLOCKS.map((block) => block.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('gives every block a distinct id, all of them exposed by BLOCK_IDS', () => {
    const ids = DEFAULT_BLOCKS.map((block) => block.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(Object.values(BLOCK_IDS))).toEqual(new Set(ids))
  })

  it('keeps Destinação do Lucro as the only block below the line', () => {
    const belowTheLine = DEFAULT_BLOCKS.filter((block) => block.belowTheLine)
    expect(belowTheLine.map((block) => block.id)).toEqual([BLOCK_IDS.profitAllocation])
    expect(belowTheLine.every((block) => block.effect === 'None')).toBe(true)
  })

  it('leaves every block of the cascade with an effect that moves the result', () => {
    const inCascade = DEFAULT_BLOCKS.filter((block) => !block.belowTheLine)
    expect(inCascade.every((block) => block.effect !== 'None')).toBe(true)
  })

  it('prints the screen prefix of each effect', () => {
    expect(LABEL_CASCADE_PREFIX.Subtract).toBe('(-)')
    expect(LABEL_CASCADE_PREFIX.Signed).toBe('(+/–)')
    expect(LABEL_CASCADE_PREFIX.Add).toBe('')
  })
})

describe('DEFAULT_CATEGORIES', () => {
  it('points every category at a block that exists', () => {
    const blockIds = new Set(DEFAULT_BLOCKS.map((block) => block.id))
    for (const category of DEFAULT_CATEGORIES) {
      expect(blockIds.has(category.blockId)).toBe(true)
    }
  })

  it('gives every category a distinct id', () => {
    const ids = DEFAULT_CATEGORIES.map((category) => category.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('leaves D&A without categories, the one read-only block', () => {
    const depreciation = DEFAULT_BLOCKS.find(
      (block) => block.id === BLOCK_IDS.depreciationAndAmortization,
    )
    expect(depreciation?.acceptsUserCategories).toBe(false)
    expect(
      DEFAULT_CATEGORIES.filter(
        (category) => category.blockId === BLOCK_IDS.depreciationAndAmortization,
      ),
    ).toEqual([])
  })

  it('is the only block that refuses user categories', () => {
    expect(
      DEFAULT_BLOCKS.filter((block) => !block.acceptsUserCategories).map((block) => block.id),
    ).toEqual([BLOCK_IDS.depreciationAndAmortization])
  })

  it('fixes Consumo Livre as a system category inside Despesas Pessoais', () => {
    const discretionary = DEFAULT_CATEGORIES.find(
      (category) => category.id === DISCRETIONARY_CATEGORY_ID,
    )
    expect(discretionary?.isSystem).toBe(true)
    expect(discretionary?.blockId).toBe(BLOCK_IDS.personalExpenses)
  })

  it('ships no category archived', () => {
    expect(DEFAULT_CATEGORIES.every((category) => !category.archived)).toBe(true)
  })

  /**
   * P8, decidido em 2026-09-09: a sugestão de Classificação existe só onde o
   * conceito se aplica. Circulante / não circulante fala de instrumento, e
   * receita não é ativo nem passivo — sugerir algo ali seria ruído que ensina a
   * pessoa a ignorar o campo.
   */
  it('P8 — só as categorias de DESPESA sugerem classificação; receita e dedução não', () => {
    const suggesting = DEFAULT_CATEGORIES.filter((c) => c.suggestedClassification !== null)
    const blocks = new Set(suggesting.map((c) => c.blockId))
    expect([...blocks].sort()).toEqual(
      [
        BLOCK_IDS.costOfServices,
        BLOCK_IDS.administrativeExpenses,
        BLOCK_IDS.personalExpenses,
      ].sort(),
    )
    expect(
      DEFAULT_CATEGORIES.filter((c) => c.blockId === BLOCK_IDS.grossRevenue).every(
        (c) => c.suggestedClassification === null,
      ),
    ).toBe(true)
  })

  it('P8 — o financiamento é a única despesa não circulante (PRD §Balanço)', () => {
    expect(
      DEFAULT_CATEGORIES.filter((c) => c.suggestedClassification === 'NonCurrent').map((c) => c.id),
    ).toEqual(['financiamento-imovel-veiculo'])
  })

  it('marks Consumo Livre as the only system category', () => {
    expect(DEFAULT_CATEGORIES.filter((category) => category.isSystem).map((c) => c.id)).toEqual([
      DISCRETIONARY_CATEGORY_ID,
    ])
  })
})
