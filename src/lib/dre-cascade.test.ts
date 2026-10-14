import { describe, expect, it } from 'vitest'
import { BLOCK_IDS } from '@/domain/chart-of-accounts'
import { operatorFor } from './dre-cascade'

describe('operatorFor — files_design/08 §4, the cascade prefix', () => {
  it('prints nothing in front of Receita Bruta (Add)', () => {
    expect(operatorFor({ kind: 'block', key: BLOCK_IDS.grossRevenue })).toBe('')
  })

  it('prints "(-)" in front of every Subtract block', () => {
    expect(operatorFor({ kind: 'block', key: BLOCK_IDS.revenueDeductions })).toBe('(-)')
    expect(operatorFor({ kind: 'block', key: BLOCK_IDS.administrativeExpenses })).toBe('(-)')
  })

  it('prints "(+/–)" in front of a Signed block (Resultado Financeiro)', () => {
    expect(operatorFor({ kind: 'block', key: BLOCK_IDS.financialResult })).toBe('(+/–)')
  })

  it('always prints "=" for a subtotal line, regardless of its key', () => {
    expect(operatorFor({ kind: 'subtotal', key: 'netProfit' })).toBe('=')
    expect(operatorFor({ kind: 'subtotal', key: 'grossProfit' })).toBe('=')
  })

  it('falls back to no prefix for an unknown block id, rather than throwing', () => {
    expect(operatorFor({ kind: 'block', key: 'not-a-real-block' })).toBe('')
  })
})
