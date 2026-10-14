import { describe, expect, it } from 'vitest'

import {
  INDICATOR_DEFINITIONS,
  INDICATOR_FAMILIES,
  INDICATOR_KEYS,
  LABEL_INDICATOR_FAMILY,
  LABEL_STATEMENT_SUBTOTAL,
} from './types'

describe('INDICATOR_DEFINITIONS', () => {
  it('defines every key exactly once', () => {
    const keys = INDICATOR_DEFINITIONS.map((indicator) => indicator.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(keys)).toEqual(new Set(INDICATOR_KEYS))
  })

  it('covers the five PRD families', () => {
    const families = new Set(INDICATOR_DEFINITIONS.map((indicator) => indicator.family))
    expect(families).toEqual(new Set(INDICATOR_FAMILIES))
    expect(Object.keys(LABEL_INDICATOR_FAMILY)).toHaveLength(5)
  })

  it('gives Custo de vida mensal the only monetary unit', () => {
    expect(
      INDICATOR_DEFINITIONS.filter((indicator) => indicator.unit === 'BRL').map((i) => i.key),
    ).toEqual(['monthlyCostOfLiving'])
    expect(
      INDICATOR_DEFINITIONS.find((indicator) => indicator.key === 'emergencyReserve')?.unit,
    ).toBe('months')
  })

  it('labels every indicator in pt-BR', () => {
    expect(INDICATOR_DEFINITIONS.every((indicator) => indicator.label.trim().length > 0)).toBe(true)
    expect(INDICATOR_DEFINITIONS[0]?.label).toBe('Margem bruta')
  })
})

describe('LABEL_STATEMENT_SUBTOTAL', () => {
  it('names the four computed lines of the cascade', () => {
    expect(LABEL_STATEMENT_SUBTOTAL).toEqual({
      netRevenue: 'Receita Líquida',
      ebitda: 'EBITDA',
      ebit: 'EBIT',
      netProfit: 'Lucro Líquido',
    })
  })
})

/**
 * files_design/05 §7, decidido em 2026-09-11. A ajuda não é enfeite: é o que
 * substituiu a faixa de referência que o PRD proíbe. Um indicador novo que
 * chegasse sem ela apareceria na tela com um "i" mudo.
 */
describe('INDICATOR_DEFINITIONS — a ajuda de cada indicador', () => {
  it('os 18 têm frase de ajuda, e nenhuma é vazia', () => {
    const semAjuda = INDICATOR_DEFINITIONS.filter((d) => d.help.trim() === '').map((d) => d.key)
    expect(semAjuda).toEqual([])
    expect(INDICATOR_DEFINITIONS).toHaveLength(18)
  })

  it('nenhuma frase julga o valor — o produto não diz se o número é bom', () => {
    const julgando = INDICATOR_DEFINITIONS.filter((d) =>
      /saudáve|recomendad|ideal|bom sinal|ruim|preocupa/i.test(d.help),
    ).map((d) => d.key)
    expect(julgando).toEqual([])
  })
})
