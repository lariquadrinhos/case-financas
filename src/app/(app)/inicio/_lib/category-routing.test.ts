import { describe, expect, it } from 'vitest'
import { isConsumoLivreCategory } from './category-routing'

describe('isConsumoLivreCategory', () => {
  it('files_design/01 §4 — a categoria de sistema Consumo Livre abre o painel próprio', () => {
    expect(isConsumoLivreCategory({ isSystem: true, name: 'Consumo Livre' })).toBe(true)
  })

  it('uma categoria comum abre o formulário genérico, nunca o painel', () => {
    expect(isConsumoLivreCategory({ isSystem: false, name: 'Casa' })).toBe(false)
  })

  it('outra categoria de sistema (hipotética) não é confundida com Consumo Livre', () => {
    expect(isConsumoLivreCategory({ isSystem: true, name: 'Outra categoria de sistema' })).toBe(
      false,
    )
  })
})
