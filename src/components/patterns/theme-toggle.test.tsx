import { describe, expect, it, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle, THEME_STORAGE_KEY } from './theme-toggle'

/**
 * files_design/02 §"Controle de tema (claro/escuro): lacuna encontrada e
 * Alternador de tema criado" — "Decisão: opção 2, toggle manual"; o híbrido de
 * 3 estados (Automático/Claro/Escuro) foi avaliado e descartado por nome:
 * "adiciona complexidade de interação... sem um motivo concreto do produto".
 * files_design/07 §Biblioteca de componentes confirma "Alternador de tema —
 * Estado (Claro, Escuro), 2 variantes" com a mesma mecânica do Controle
 * segmentado, que "sempre tem um item ativo".
 *
 * Bug reproduzido antes da correção: o componente tinha um 3º estado
 * `'system'` como padrão, e clicar no ícone já ativo voltava pra esse estado
 * — nenhum dos dois ícones ficava marcado como ativo (`aria-pressed="false"`
 * nos dois), exatamente o híbrido de 3 estados que o doc02 rejeitou.
 */
describe('ThemeToggle (files_design/02, files_design/07 — 2 estados, nunca 3)', () => {
  afterEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY)
    cleanup()
  })

  it('clicar no ícone já ativo mantém ele ativo — não existe um 3º estado "sem nenhum ativo"', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    const light = await screen.findByRole('button', { name: 'Tema claro' })
    await user.click(light)
    expect(light).toHaveAttribute('aria-pressed', 'true')

    await user.click(light)
    expect(light).toHaveAttribute('aria-pressed', 'true')
  })

  it('sempre exatamente um ícone ativo depois de montado, nunca os dois inativos ao mesmo tempo', async () => {
    render(<ThemeToggle />)

    const light = await screen.findByRole('button', { name: 'Tema claro' })
    const dark = await screen.findByRole('button', { name: 'Tema escuro' })

    const pressedCount = [light, dark].filter(
      (btn) => btn.getAttribute('aria-pressed') === 'true',
    ).length
    expect(pressedCount).toBe(1)
  })

  it('escolher escuro e depois clicar em claro troca o ativo direto, sem passar por um estado intermediário sem ativo', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    const light = await screen.findByRole('button', { name: 'Tema claro' })
    const dark = await screen.findByRole('button', { name: 'Tema escuro' })

    await user.click(dark)
    expect(dark).toHaveAttribute('aria-pressed', 'true')
    expect(light).toHaveAttribute('aria-pressed', 'false')

    await user.click(light)
    expect(light).toHaveAttribute('aria-pressed', 'true')
    expect(dark).toHaveAttribute('aria-pressed', 'false')
  })

  it('grava só "light" ou "dark" no localStorage, nunca um 3º valor "system"', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    const dark = await screen.findByRole('button', { name: 'Tema escuro' })
    await user.click(dark)

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })
})
