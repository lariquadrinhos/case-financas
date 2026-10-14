import { describe, expect, it } from 'vitest'
import { nextClassification } from './classification-suggestion'

describe('nextClassification', () => {
  it('suggests NonCurrent when the name matches no keyword and the field was never touched', () => {
    expect(
      nextClassification({ name: 'Empréstimo do tio', touched: false, current: 'Current' }),
    ).toBe('NonCurrent')
  })

  it('suggests Current from a "cartao" keyword in the name', () => {
    expect(
      nextClassification({ name: 'Cartão de crédito', touched: false, current: 'NonCurrent' }),
    ).toBe('Current')
  })

  it('suggests NonCurrent from a "financiamento" keyword in the name', () => {
    expect(
      nextClassification({ name: 'Financiamento apartamento', touched: false, current: 'Current' }),
    ).toBe('NonCurrent')
  })

  it('never overrides a manual choice once the segmented control has been touched, even if the name changes afterwards', () => {
    // The person typed "Cartão de crédito" (auto-suggests Current), then
    // clicked "Não circulante" themselves, then kept editing the name.
    expect(
      nextClassification({
        name: 'Cartão de crédito guardado',
        touched: true,
        current: 'NonCurrent',
      }),
    ).toBe('NonCurrent')
  })
})
