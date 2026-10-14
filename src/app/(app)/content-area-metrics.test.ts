import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Geometria da ÁREA DE CONTEÚDO, medida na página **Mockup** do Figma.
 *
 * O DEFEITO que estes testes travam: `--width-content-max: 1066px` trazia como
 * única justificativa o comentário `/* frame 317:2 *\/`, e `(app)/layout.tsx`
 * casava com ele usando `px-48`. Os dois números vêm do **Wireframe**, onde a
 * barra lateral mede 278 (278 + 48 + 1066 + 48 = 1440). Depois que a largura da
 * barra lateral foi corrigida para os 272 do Mockup (ADR-0015 §1: a camada
 * visual do Mockup vence a medição antiga), a conta parou de fechar: sobravam
 * 1168 de área e o conteúdo continuava desenhado para 1162.
 *
 * A medição (mcp__figma__get_metadata, página Mockup 552:2), em duas telas
 * independentes, é unânime — área de conteúdo de 1168 começando em x=272,
 * TODO filho em x=40 com width=1088:
 *
 *   549:44 "Desktop — Início dashboard (claro)" (1440 de largura)
 *     749:2  "Barra lateral" x=0   w=272
 *     549:70 "Frame"         x=272 w=1168
 *       549:71  x=40 w=1088   549:75  x=40 w=1088   549:173 x=40 w=1088
 *       549:242 x=40 w=1088   549:119 x=40 w=1088   549:276 x=40 w=1088
 *
 *   397:2 "Desktop — DRE (claro)" (1440 de largura)
 *     397:3  "Barra lateral" x=0   w=272
 *     397:26 "Conteúdo"      x=272 w=1168
 *       397:27 x=40 w=1088   397:28 x=40 w=1088
 *       397:29 x=40 w=1088   397:30 x=40 w=1088
 *
 * 272 + 40 + 1088 + 40 = 1440, exato. É esta identidade que os testes abaixo
 * verificam — nenhum dos quatro números pode mudar sozinho.
 */

const MOCKUP_FRAME_WIDTH = 1440
const MOCKUP_SIDEBAR = 272 // 749:2 · 397:3
const MOCKUP_CONTENT_INSET = 40 // x de todo filho de 549:70 e de 397:26
const MOCKUP_CONTENT_COLUMN = 1088 // width de todo filho de 549:70 e de 397:26

const tokensCss = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')
const layoutTsx = readFileSync(resolve(process.cwd(), 'src/app/(app)/layout.tsx'), 'utf8')

function tokenPx(name: string): number {
  const match = new RegExp(`^\\s*${name}:\\s*(\\d+)px;`, 'm').exec(tokensCss)
  if (match === null) throw new Error(`${name} não está declarado em tokens.css`)
  return Number(match[1])
}

/** A `className` do único `<main>` do shell. */
function mainClassName(): string {
  const match = /<main[^>]*className="([^"]*)"/.exec(layoutTsx)
  const className = match?.[1]
  if (className === undefined) throw new Error('nenhum <main className="…"> em (app)/layout.tsx')
  return className
}

describe('Figma Mockup 549:70 e 397:26 — geometria da área de conteúdo', () => {
  it('a coluna de conteúdo mede 1088, a largura desenhada em 549:71 e 397:27', () => {
    expect(tokenPx('--width-content-max')).toBe(MOCKUP_CONTENT_COLUMN)
  })

  it('o recuo lateral do <main> é 40, o x de todo filho de 549:70 e 397:26', () => {
    const padding = /(?:^|\s)px-(\d+)(?:\s|$)/.exec(mainClassName())
    expect(padding, `<main> sem classe px-N: "${mainClassName()}"`).not.toBeNull()
    expect(Number(padding?.[1])).toBe(MOCKUP_CONTENT_INSET)
  })

  it('o recuo do topo do <main> é 40 (549:71 y=40; 397:27 y=32 + 8 de folga do card)', () => {
    expect(mainClassName()).toMatch(/(?:^|\s)py-40(?:\s|$)/)
  })

  it('`--width-content-max` limita a COLUNA, não a caixa com o recuo somado', () => {
    // Sem `box-content`, o reset do Tailwind deixa `box-sizing: border-box` e
    // `max-w-[1088px] px-40` daria uma coluna de 1088 − 80 = 1008 — 80px a
    // menos do que 549:71/397:27 desenham. `box-content` é o que faz o token
    // significar literalmente a largura medida no frame.
    const className = mainClassName()
    expect(className).toContain('max-w-[var(--width-content-max)]')
    expect(className).toMatch(/(?:^|\s)box-content(?:\s|$)/)
  })

  it('barra lateral + recuo + coluna + recuo fecham os 1440 do frame 549:44 / 397:2', () => {
    const total =
      tokenPx('--width-sidebar') +
      MOCKUP_CONTENT_INSET +
      tokenPx('--width-content-max') +
      MOCKUP_CONTENT_INSET

    expect(tokenPx('--width-sidebar')).toBe(MOCKUP_SIDEBAR)
    expect(total).toBe(MOCKUP_FRAME_WIDTH)
  })
})
