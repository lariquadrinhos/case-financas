import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { cents } from '@/domain/core'
import { Treemap } from './treemap'

// jsdom não faz layout: a largura "medida" do contêiner (§2.3) vem daqui.
const AVAILABLE_WIDTH = 1046

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: AVAILABLE_WIDTH,
  } as DOMRect)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Treemap — rótulo dentro do bloco (files_design/08 §2.6)', () => {
  // Figma, frame 5-2 (Faixa - Ativos): o nome fica em y=10 e o valor logo
  // abaixo, no topo do bloco, alinhados com a seta ↗. O código centralizava na
  // vertical, e num bloco de 150px o nome descia ~55px abaixo da seta.
  it('nome e valor ficam no topo do bloco, não centralizados na vertical', () => {
    render(<Treemap items={[{ id: 'a', name: 'Casa', value: cents(1_000_00) }]} height={150} />)

    const label = screen.getByText('Casa').parentElement!
    expect(label).toHaveClass('justify-start')
    expect(label).not.toHaveClass('justify-center')
  })
})

describe('Treemap — nome e seta ocupam posições independentes (files_design/08 §2.6)', () => {
  // §2.6: "o nome corta com reticências antes de encostar no ícone". Medido em
  // 2026-09-23 num bloco de 110px: o nome truncava na largura toda e as
  // reticências ficavam por baixo da seta, que é posicionada por cima.
  it('o nome reserva à direita o espaço da seta, para cortar antes dela', () => {
    render(
      <Treemap
        items={[{ id: 'a', name: 'Um nome bem comprido', value: cents(1_000_00) }]}
        height={150}
      />,
    )

    const name = screen.getByText('Um nome bem comprido')
    // seta de 14 + a folga de 8 até ela
    expect(parseFloat(name.style.paddingRight)).toBe(22)
  })

  it('sem seta (bloco estreito), o nome usa a largura toda', () => {
    render(
      <Treemap
        items={[{ id: 'a', name: 'Estreito', value: cents(1_000_00) }]}
        height={150}
        widthRatio={0.1}
      />,
    )

    expect(screen.getByText('Estreito').style.paddingRight).toBe('')
  })
})

describe('Treemap — largura mínima da faixa proporcional (files_design/08 §2.11)', () => {
  it('uma dívida de 2,4% dos ativos ainda mostra o nome e o valor', () => {
    render(
      <Treemap
        items={[{ id: 'd', name: 'Dívidas (Passivos)', value: cents(6_000_00) }]}
        height={60}
        widthRatio={0.024}
        minWidth={120}
        variant="outlined"
      />,
    )

    const block = screen.getByRole('button', { name: /Dívidas \(Passivos\)/ })
    expect(parseFloat(block.style.width)).toBe(120)
    expect(screen.getByText('Dívidas (Passivos)')).toBeInTheDocument()
    expect(screen.getByText(/R\$\s6\.000/)).toBeInTheDocument()
  })
})
