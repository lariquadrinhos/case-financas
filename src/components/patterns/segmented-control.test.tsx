import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SegmentedControl } from './segmented-control'

/**
 * Relato do dono, 2026-10-01: "o hover e o fundo dos botões selecionados ou
 * quando o mouse em cima está ruim de identificar a transição no modo claro".
 * Medido em tokens.css (claro): card #ffffff × trilho #f4f5f6 = 1,09:1 —
 * invisível. Regra de densidade nº 11 do files_design/07: um estado muda em
 * DUAS propriedades independentes, nunca só na cor de fundo.
 */
describe('SegmentedControl — selecionado e hover legíveis no claro', () => {
  const options = [
    { value: 'a', label: 'Pago' },
    { value: 'b', label: 'Previsto' },
  ]

  it('o selecionado tem borda de controle (3:1 contra o trilho) e texto primário — sem azul ("fora do padrão", dono)', () => {
    render(<SegmentedControl value="a" onValueChange={() => {}} options={options} />)
    const checked = screen.getByRole('radio', { name: 'Pago' })
    expect(checked.className).toContain('data-[state=checked]:border-line-control')
    expect(checked.className).toContain('data-[state=checked]:text-ink-primary')
    expect(checked.className).not.toContain('text-ink-state')
  })

  it('o hover usa o fundo de hover dedicado, não o do trilho', () => {
    render(<SegmentedControl value="a" onValueChange={() => {}} options={options} />)
    const other = screen.getByRole('radio', { name: 'Previsto' })
    expect(other.className).toContain('hover:bg-surface-hover')
    expect(other.className).not.toContain('hover:bg-surface-subtle')
  })
})
