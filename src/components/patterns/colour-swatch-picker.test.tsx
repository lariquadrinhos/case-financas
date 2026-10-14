import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ColourSwatchPicker } from './colour-swatch-picker'
import { BANK_SUGGESTION_SWATCHES } from '@/lib/bank-account-colours'

/**
 * A fila de cores do campo "Cor" ESTÁ desenhada, nas duas páginas do arquivo
 * Figma, com a geometria fechada — não é um controle inventado pelo código:
 *
 * - Mockup: `1111:8`/`1111:10` (Desktop — Onboarding 2, claro) e
 *   `921:40`/`921:42` (Desktop — Contas Bancárias, claro);
 * - Wireframe: `36:2`/`36:4` em `29:39`
 *   (docs/figma/frames/29-39__onboarding-2-contas-bancarias.xml, linhas 51-61)
 *   e `332:115`/`332:117` em `332:2`
 *   (docs/figma/frames/332-2__desktop-contas-bancarias.xml, linhas 66-76).
 *
 * Os quatro frames medem o MESMO: 6 elipses de 28×28 em x=0/40/80/120/160/200,
 * dentro de um container de 228px de largura. Passo 40 − círculo 28 = GAP 12,
 * e a aritmética fecha: 6×28 + 5×12 = 228. Com `gap-8` a fila mede
 * 6×28 + 5×8 = 208px — 20px a menos que os quatro frames.
 */
describe('ColourSwatchPicker — geometria da fila (Figma 1111:10 / 921:42 / 36:4 / 332:117)', () => {
  it('espaça os 6 círculos com a folga 12 do frame (6×28 + 5×12 = 228), nunca 8', () => {
    render(
      <ColourSwatchPicker
        aria-label="Cor"
        swatches={BANK_SUGGESTION_SWATCHES}
        value={BANK_SUGGESTION_SWATCHES[0]!.slug}
        onValueChange={() => {}}
      />,
    )

    const group = screen.getByRole('radiogroup', { name: 'Cor' })

    // 6×28 + 5×12 = 228 = largura literal de 1111:10 / 921:42 / 36:4 / 332:117.
    expect(group.className).toContain('gap-12')
    expect(group.className.split(/\s+/)).not.toContain('gap-8')
    // Seis vagas, como nos quatro frames — mas desde 2026-09-11 a 6ª é o
    // gatilho do color pick, não uma cor. A geometria não mudou; o que ocupa a
    // última vaga mudou.
    expect(screen.getAllByRole('radio')).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Escolher outra cor' })).toBeInTheDocument()
  })
})

/**
 * O estado selecionado NÃO é lacuna do design: ele está desenhado em
 * `921:42` (Mockup, "Desktop — Contas Bancárias (claro)" → Card / Adicionar
 * conta → `921:40` "Cor"). Medido pixel a pixel no PNG nativo 228×28 do nó,
 * na linha central y=14:
 *
 *   x=0..1   #d3d7da   ← anel de 2px do círculo 1 (selecionado)
 *   x=2..25  #820ad1   ← fill Nubank, sem nenhuma marca dentro
 *   x=26..27 #d3d7da
 *   x=40     #e6e8ea   ← traço de 1px do círculo 2
 *   x=41..66 #ec7000
 *
 * e o mesmo 1px de #e6e8ea nos círculos 3..6. #d3d7da é
 * `--color-border-strong`, #e6e8ea é `--color-border-default`
 * (src/styles/tokens.css:38 e 40). A varredura do interior do círculo 1
 * (x 4..23 × y 4..23) devolve só o roxo, o cinza da borda e o antialias
 * entre os dois — nenhum pixel claro: **não existe check dentro da bolinha**.
 */
describe('ColourSwatchPicker — estado selecionado (Figma 921:42)', () => {
  function renderPicker() {
    render(
      <ColourSwatchPicker
        aria-label="Cor"
        swatches={BANK_SUGGESTION_SWATCHES}
        value={BANK_SUGGESTION_SWATCHES[0]!.slug}
        onValueChange={() => {}}
      />,
    )
    return screen.getAllByRole('radio')
  }

  it('desenha o selecionado com o anel --stroke-swatch-selected em border-strong, sem check', () => {
    const [selected] = renderPicker()

    expect(selected!.getAttribute('data-state')).toBe('checked')
    expect(selected!.className).toContain('data-[state=checked]:border-line-strong')
    expect(selected!.className).toContain(
      'data-[state=checked]:border-[length:var(--stroke-swatch-selected)]',
    )
    // x=2..25 do nó 921:42 é fill puro: nada é desenhado dentro do círculo.
    expect(selected!.querySelector('svg')).toBeNull()
  })

  it('desenha os não-selecionados com o traço --stroke-hairline em border-default', () => {
    const radios = renderPicker()

    for (const radio of radios) {
      expect(radio.className).toContain('border-line-default')
      expect(radio.className).toContain('border-[length:var(--stroke-hairline)]')
    }
    // Nenhum dos seis carrega marca interna, em nenhum estado.
    expect(radios.every((radio) => radio.querySelector('svg') === null)).toBe(true)
  })

  it('mantém a fila numa linha só, como a faixa fixa de 228 do frame', () => {
    renderPicker()

    const group = screen.getByRole('radiogroup', { name: 'Cor' })
    expect(group.className.split(/\s+/)).not.toContain('flex-wrap')
  })
})
