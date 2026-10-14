import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MonthNav } from './month-nav'
import type { Month } from '@/domain/core'

/**
 * Mockup `549:185` (canvas 552:2) desenha o seletor de mês como
 * `icon/arrow-left` (instância 677:6, 20×20) → "Julho 2026" (549:187) →
 * `icon/arrow-right` (instância 677:8, 20×20). São INSTÂNCIAS da biblioteca de
 * ícones, não nós de texto: o master 470:8 é um `<vector>` de 8×8 em (6,6)
 * dentro da caixa de 20×20.
 *
 * files_design/07 §"Botão de ícone / quando usar" dá "as setas do seletor de
 * mês (`← Julho 2026 →`, DRE e outros relatórios)" como PRIMEIRO exemplo do
 * componente, e §"Biblioteca de ícones" lista `arrow-left`/`arrow-right` como
 * "navegação/paginação" — nunca "reservado para paginação".
 *
 * O `←`/`→` do Wireframe 11:28 (11:29, 11:31) é a convenção cinza do
 * Wireframe, que escreve TODO ícone como caractere (o mesmo XML traz `↗` em
 * 257:3 para o `icon/arrow-diagonal`). Para camada visual, files_design/07 e a
 * página Mockup vencem o Wireframe (ADR-0015).
 *
 * Defeito medido antes da correção: o DOM trazia
 * `<span aria-hidden="true">←</span>` — glifo da fonte, que herda o
 * `font-size` do botão em vez dos 20×20 com traço de 1,5px e ponta arredondada
 * da biblioteca.
 */
describe('MonthNav (Mockup 549:185 — setas são icon/arrow-left e icon/arrow-right)', () => {
  afterEach(cleanup)

  const renderNav = () => render(<MonthNav month={'2026-07' as Month} onMonthChange={() => {}} />)

  it('desenha as setas como ícone da biblioteca (SVG 20×20, traço 1,5), não como glifo de texto', () => {
    renderNav()

    for (const name of ['Mês anterior', 'Próximo mês']) {
      const button = screen.getByRole('button', { name })
      const svg = button.querySelector('svg')

      expect(svg, `${name} deveria conter o SVG do ícone`).not.toBeNull()
      expect(svg?.getAttribute('viewBox')).toBe('0 0 20 20')
      expect(svg?.getAttribute('width')).toBe('20')
      expect(svg?.getAttribute('height')).toBe('20')
      expect(svg?.getAttribute('stroke-width')).toBe('1.5')
      expect(svg?.getAttribute('stroke-linecap')).toBe('round')
      expect(svg?.getAttribute('stroke-linejoin')).toBe('round')
    }
  })

  it('não renderiza os caracteres ← e → como texto (Wireframe 11:29/11:31 é convenção do Wireframe, não a camada visual)', () => {
    renderNav()

    expect(screen.getByRole('button', { name: 'Mês anterior' }).textContent).not.toContain('←')
    expect(screen.getByRole('button', { name: 'Próximo mês' }).textContent).not.toContain('→')
  })

  it('mantém a ordem do frame: seta esquerda, "Julho 2026", seta direita', () => {
    const { container } = renderNav()
    const nav = container.firstElementChild as HTMLElement

    expect(
      Array.from(nav.children).map(
        (child) => child.getAttribute('aria-label') ?? child.textContent,
      ),
    ).toEqual(['Mês anterior', 'Julho 2026', 'Próximo mês'])
  })
})

/**
 * Geometria do seletor, medida agora via MCP nos três nós que o desenham:
 *
 * - Mockup `398:19` "Seletor de mês" — 188×36, três células "Passo"
 *   CONTÍGUAS: `398:20` (x=0, 44×36, `icon/arrow-left` 701:6 em 12,8 20×20) ·
 *   `398:22` (x=44, **100×36**, texto `398:23` "Julho 2026" em x=12, **w=76**) ·
 *   `398:24` (x=144, 44×36, `icon/arrow-right` 701:8).
 * - Mockup `448:71` — idêntico: `448:72` (44) · `448:74` **100×36** com
 *   `448:75` "Julho 2026" x=12 w=76 · `448:76` (44).
 * - Mockup `549:185` (a instância aplicada na tela Início) — 164×36:
 *   `677:6` arrow-left x=12 (12→32) · `549:187` "Julho 2026" x=44 **w=76**
 *   (44→120) · `677:8` arrow-right x=132 (132→152). O intervalo reservado ao
 *   rótulo é 32→132 = **100px**, com o texto de 76 centrado (12 de cada lado).
 *
 * Os três concordam: a célula do rótulo mede **100px** e é contígua às células
 * das setas (gap 0) — o respiro de 12px vem do padding interno da célula, não
 * de um `gap` entre irmãos.
 */
describe('Seletor de mês — geometria (Mockup 398:22 / 448:74 / 549:185)', () => {
  afterEach(cleanup)

  const tokens = readFileSync(path.resolve(__dirname, '..', '..', 'styles', 'tokens.css'), 'utf8')

  const renderNav = () => render(<MonthNav month={'2026-07' as Month} onMonthChange={() => {}} />)

  it('--width-month-label é a célula "Passo" do rótulo, 100×36 (398:22 e 448:74), não um valor arredondado à mão', () => {
    const declared = /--width-month-label:\s*(\d+)px;/.exec(tokens)?.[1]

    expect(declared).toBe('100')
  })

  it('o comentário do token não alega mais o arredondamento inventado sobre os 66 do texto no Wireframe 112:24', () => {
    expect(tokens).not.toContain('rounded up to the 4-grid')
  })

  it('as células são contíguas: o seletor não separa seta e rótulo com gap (398:19 desenha as três "Passo" encostadas)', () => {
    const { container } = renderNav()
    const nav = container.firstElementChild as HTMLElement

    expect(nav.className).not.toMatch(/(^|\s)gap-\d/)
  })

  it('o rótulo ocupa a célula de largura fixa, e é ela que mantém as setas paradas de "Maio" a "Setembro"', () => {
    renderNav()

    expect(screen.getByText('Julho 2026').className).toContain('min-w-[var(--width-month-label)]')
  })
})
