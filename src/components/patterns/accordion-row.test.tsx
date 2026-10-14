import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { AccordionRow } from './accordion-row'

/**
 * files_design/07 §328, "Linha expansível": `icon/chevron-right` (recolhido)
 * ou `icon/chevron-down` (expandido) — os masters 470:4 e 470:2 do Style
 * guide, medidos por `get_metadata` no arquivo `7IZBeQV15kgZp7Shcqh4c8`:
 *
 *   470:2 `icon/chevron-down`  → vector 470:3, 8×4 em (6,8) na caixa de 20×20
 *   470:4 `icon/chevron-right` → vector 470:5, 4×8 em (8,6)
 *
 * O DEFEITO que este teste trava: o chevron era um SVG local desenhado à mão,
 * `M5 8l5 5 5-5` / `M8 5l5 5-5 5` — 10 de largura (x=5 a x=15) contra os 8 do
 * master, 2px a mais em cada lado, e um traçado a mais para manter no
 * repositório do que o componente compartilhado de `@/components/ui/icons`.
 */
describe('AccordionRow — chevron (files_design/07 §328, Style guide 470:2 / 470:4)', () => {
  it('470:2 — expandido usa o traçado do master icon/chevron-down', () => {
    const { container } = render(
      <AccordionRow title="5. Despesas Pessoais/Consumo" open onOpenChange={vi.fn()}>
        <p>conteúdo</p>
      </AccordionRow>,
    )

    expect(container.querySelector('svg path')?.getAttribute('d')).toBe('M6 8L10 12L14 8')
  })

  it('470:4 — recolhido usa o traçado do master icon/chevron-right', () => {
    const { container } = render(
      <AccordionRow title="5. Despesas Pessoais/Consumo" open={false} onOpenChange={vi.fn()}>
        <p>conteúdo</p>
      </AccordionRow>,
    )

    expect(container.querySelector('svg path')?.getAttribute('d')).toBe('M8 6L12 10L8 14')
  })
})
