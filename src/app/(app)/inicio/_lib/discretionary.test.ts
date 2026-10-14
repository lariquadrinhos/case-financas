import { describe, expect, it } from 'vitest'
import { progressWidthPercent } from './discretionary'

describe('progressWidthPercent', () => {
  it('files_design/08 §9.2 — barra proporcional dentro do limite', () => {
    expect(progressWidthPercent(35000, 50000)).toBe(70)
  })

  it('files_design/08 §9.2 — gasto ultrapassa o limite: a barra para em 100%, nunca estoura', () => {
    expect(progressWidthPercent(70000, 50000)).toBe(100)
  })

  it('sem gasto: barra em 0%', () => {
    expect(progressWidthPercent(0, 50000)).toBe(0)
  })

  it('limite zero (caso degenerado): nunca divide por zero nem devolve Infinity/NaN', () => {
    expect(progressWidthPercent(1000, 0)).toBe(100)
    expect(progressWidthPercent(0, 0)).toBe(0)
  })
})
