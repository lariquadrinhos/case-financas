import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HideToggle } from './hide-toggle'

// Pedido do dono, 2026-10-01: "faz o olhinho abrir e fechar para ser
// visualmente mais legível" — oculto é um olho FECHADO, não um olho riscado.
describe('HideToggle — olho aberto / olho fechado', () => {
  const pathsOf = (name: string) =>
    [...screen.getByRole('button', { name }).querySelectorAll('path')].map((p) =>
      p.getAttribute('d'),
    )

  it('visível: olho aberto, com íris', () => {
    render(<HideToggle hidden={false} onToggle={() => {}} />)
    const paths = pathsOf('Ocultar do DRE')
    expect(paths.some((d) => d?.includes('A2.5 2.5'))).toBe(true)
  })

  it('oculto: olho fechado — sem íris e sem o risco diagonal', () => {
    render(<HideToggle hidden onToggle={() => {}} />)
    const paths = pathsOf('Mostrar no DRE')
    expect(paths.some((d) => d?.includes('A2.5 2.5'))).toBe(false)
    expect(paths).not.toContain('M4 4L16 16')
    expect(paths.length).toBeGreaterThan(1)
  })
})
