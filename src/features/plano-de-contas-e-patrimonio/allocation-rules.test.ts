import { describe, expect, it } from 'vitest'
import { cents } from '@/domain/core'
import { fitsWithinRemaining, remainingToAllocate } from './allocation-rules'

describe('files_design/03 "Vender Bem Material" — soma dos Direcionamentos nunca excede o valor de venda', () => {
  it('remainingToAllocate subtracts every allocation already added from the sale amount', () => {
    const remaining = remainingToAllocate(cents(10_000), [
      { amount: cents(3_000) },
      { amount: cents(2_000) },
    ])
    expect(remaining).toBe(cents(5_000))
  })

  it('fitsWithinRemaining refuses a new allocation that would exceed the Restante', () => {
    const remaining = remainingToAllocate(cents(10_000), [{ amount: cents(9_000) }])
    expect(fitsWithinRemaining(cents(2_000), remaining)).toBe(false)
  })

  it('fitsWithinRemaining accepts a new allocation that exactly exhausts the Restante', () => {
    const remaining = remainingToAllocate(cents(10_000), [{ amount: cents(6_000) }])
    expect(fitsWithinRemaining(cents(4_000), remaining)).toBe(true)
  })

  it('fitsWithinRemaining refuses a zero or negative amount — a direcionamento of nothing is not one', () => {
    expect(fitsWithinRemaining(cents(0), cents(10_000))).toBe(false)
  })
})
