import { describe, expect, it } from 'vitest'

import { isCardBillPayment, isOwnMoneyMovement, isRefund } from './category-mapping'

/**
 * PRD v7.46: a categoria da Pluggy não escolhe mais categoria do Plano de
 * Contas — a pessoa categoriza. Ela só serve para as três perguntas abaixo,
 * que decidem se a transação entra no DRE, e não onde.
 */
describe('o que a categoria da Pluggy ainda decide', () => {
  it('aplicação e transferência de mesma titularidade são dinheiro próprio, fora do DRE', () => {
    expect(isOwnMoneyMovement('Automatic investment')).toBe(true)
    expect(isOwnMoneyMovement('Same person transfer')).toBe(true)
    expect(isOwnMoneyMovement('Transfer - PIX')).toBe(false)
  })

  it('entrada com categoria de gasto é estorno', () => {
    expect(isRefund('Groceries', 'x')).toBe(true)
    expect(isRefund(null, 'ESTORNO SINTETICO')).toBe(true)
    expect(isRefund('Salary', 'x')).toBe(false)
  })

  it('pagamento de fatura é reconhecido pela categoria', () => {
    expect(isCardBillPayment('Credit card payment')).toBe(true)
  })
})
