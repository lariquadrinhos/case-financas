import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './button'

/**
 * Altura do Botão — medida no Figma, não deduzida.
 *
 * Style guide, frame 458:26 "Botão" (dentro de 502:446, página 383:2): os 12
 * símbolos `btn/{primary,secondary,text}/{default,hover,focus,disabled}`
 * (458:2, 458:4, 458:6, 458:8, 458:10, 458:12, 458:14, 458:16, 458:18,
 * 458:20, 458:22, 458:24) medem TODOS 72×44. Não existe símbolo de botão de
 * 32, de 40 nem de 43 no arquivo.
 *
 * Mockup (552:2) confirma no produto aplicado: o CTA da barra lateral
 * 936:1550 é 240×44, e o rodapé do Onboarding 1 (988:2079) traz três
 * instâncias "Botão" — 988:2080, 988:2083 e 988:2085 — todas de altura 44.
 *
 * O que existia antes desta correção e que o Figma NÃO desenha:
 *   - `size="default"` usava `--height-control` (32px). 32 é a altura do
 *     **Botão de ícone** (Style guide 532:476, símbolos 532:467/470/473,
 *     32×32; files_design/07 §292 "Contêiner de 32×32"), não a do Botão.
 *   - `size="large"` usava `--height-action` (43px), medido do Wireframe
 *     26:28. O Mockup desenha esse mesmo botão com 44 (936:1550).
 *   - `size="field"` usava `--height-field` (40px). 40 é a altura da **Caixa**
 *     do Campo (Style guide 460:3 → 460:5, 240×40), nunca de um botão.
 */
describe('Button — altura', () => {
  it('Figma 458:2..458:24 — todo botão de texto mede 44 de altura (--height-button)', () => {
    render(<Button>Salvar</Button>)

    const button = screen.getByRole('button', { name: 'Salvar' })
    expect(button.className).toContain('h-[var(--height-button)]')
    expect(button.className).not.toContain('h-[var(--height-control)]')
  })

  it('Figma 936:1550 — o CTA `large` mede os mesmos 44, não 43', () => {
    render(<Button size="large">+ Novo Lançamento</Button>)

    const button = screen.getByRole('button', { name: '+ Novo Lançamento' })
    expect(button.className).toContain('h-[var(--height-button)]')
    expect(button.className).not.toContain('h-[var(--height-action)]')
  })

  it('Figma 532:467 — o botão de ícone continua 32×32 (--height-control)', () => {
    render(
      <Button size="icon" aria-label="Fechar">
        ×
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Fechar' })
    expect(button.className).toContain('h-[var(--height-control)]')
    expect(button.className).toContain('w-[var(--height-control)]')
  })

  it('2026-10-01 — `compact` é a ação de linha: 32 de altura (--height-control), com respiro horizontal', () => {
    // Pedido do dono: "Marcar pago, Descartar e Editar não parecem um botão".
    // O botão Texto (sem fundo nem contorno) virou Secundário compacto nas
    // linhas de tabela; 44 de altura dobraria a linha.
    render(
      <Button variant="secondary" size="compact">
        Editar
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Editar' })
    expect(button.className).toContain('h-[var(--height-control)]')
    expect(button.className).toContain('px-12')
    expect(button.className).not.toContain('h-[var(--height-button)]')
    expect(button.className).toContain('border-line-control')
  })

  it('2026-10-01 — o hover do Secundário usa o fundo de hover dedicado, legível no claro', () => {
    render(<Button variant="secondary">Editar</Button>)
    const button = screen.getByRole('button', { name: 'Editar' })
    expect(button.className).toContain('hover:bg-surface-hover')
    expect(button.className).not.toContain('hover:bg-surface-subtle')
  })
})
