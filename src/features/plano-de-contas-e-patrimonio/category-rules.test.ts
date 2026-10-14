import { describe, expect, it } from 'vitest'
import { isDuplicateCategoryName } from './category-rules'

describe('files_design/01 §3.1 — Plano de Contas: "Não há opção de criar duplicata"', () => {
  const existing = [{ name: 'Vestuário' }, { name: 'Transporte' }]

  it('flags an exact-name match', () => {
    expect(isDuplicateCategoryName(existing, 'Transporte')).toBe(true)
  })

  it('flags a match typed without accent and in a different case ("vestuario")', () => {
    expect(isDuplicateCategoryName(existing, 'vestuario')).toBe(true)
  })

  it('lets a genuinely new name through', () => {
    expect(isDuplicateCategoryName(existing, 'Lazer')).toBe(false)
  })
})
