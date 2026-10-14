import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Empty } from './empty'
import { EMPTY_STATES } from './empty-states'

/**
 * Largura da mensagem do estado Vazio — o Wireframe desenha o número, e o
 * desenha 25 vezes. Frame de referência `309:47` "Vazio — DRE"
 * (docs/figma/frames/309-47__vazio-dre.xml), literal:
 *
 *   frame 309:47 ......................... 420 × 210
 *     text 309:48 (título) ............... x=103.5 y=40  213×18
 *     text 309:49 (mensagem) ............. x=40    y=66  **340**×45
 *     rectangle 309:50 (espaçador de 8) .. x=209.5 y=119 1×8
 *     frame 309:51 (botão) ............... x=134.5 y=135 151×35
 *
 * A conta fecha nas duas direções: 40 + 340 + 40 = 420 na horizontal, e o
 * botão terminando em 170 contra um card de 210 dá os mesmos 40 embaixo. Ou
 * seja, a mensagem ocupa a LARGURA INTEIRA do content box — não sobra folga.
 *
 * O mesmo par x=40 / width=340 dentro de um card de 420 aparece SEM EXCEÇÃO em
 * todos os irmãos: `309:2` Pendências, `309:5` Mapa de Fluxo, `309:11`
 * Despesas por Categoria, `309:17` Onde Está Meu Dinheiro, `309:23` Eventos
 * Recentes, `309:53` Balanço, `309:59` Evolução Mensal, `309:62` Indicadores,
 * `309:88` Revisão de Recorrentes, `309:94` Histórico, `309:100` Contas
 * Bancárias, `309:106` Bens Materiais, `309:112` Investimentos, `309:118`
 * Passivos, e as cópias in-situ `305:1409`, `305:1415`, `305:1421`,
 * `305:1424`, `305:1434`, `305:1440`, `305:1446`, `305:1452`, `305:1458`,
 * `305:1464` e `311:1699`. Só a ALTURA do parágrafo varia (15/30/45/48),
 * conforme o número de linhas.
 *
 * INVERSÃO VERIFICADA: com `--width-empty-message: 320px` (o valor de
 * `git show HEAD:src/styles/tokens.css`, declarado sem citar frame nenhum num
 * bloco cujo cabeçalho promete "Layout facts sampled from the Figma frames")
 * os dois primeiros testes ficam vermelhos. E não era só um número torto: 320
 * estreitava o texto 20px ABAIXO do próprio `px-40` que o cerca, deixando 10px
 * de folga morta de cada lado que o Figma não desenha e empurrando para uma 4ª
 * linha os quatro estados que o Figma fecha em 3 (`309:2`, `309:47`, `309:59`
 * e `309:88`, todos com o parágrafo em h=45 = 3 × 15) — o que muda a altura
 * desenhada do card de 210 para 225.
 */

const CARD_WIDTH = 420 // 309:47 e os 24 irmãos
const CARD_PADDING = 40 // 309:49 em x=40; o botão 309:51 fecha em 170 de 210

function emptyMessageToken(): number {
  const css = readFileSync(path.resolve(__dirname, '../../styles/tokens.css'), 'utf8')
  return Number(/^\s*--width-empty-message:\s*(\d+)px/m.exec(css)?.[1])
}

describe('Empty — largura da mensagem (Figma 309:47 e os 24 frames "Vazio —" irmãos)', () => {
  it('mede os 340 que 309:49 desenha, iguais nos 25 frames', () => {
    expect(emptyMessageToken()).toBe(340)
  })

  it('fecha a aritmética do card: 40 + 340 + 40 = 420, sem folga morta', () => {
    render(<Empty copy={EMPTY_STATES.DRE} actionHref="/novo-lancamento" />)

    const container = screen.getByText(EMPTY_STATES.DRE.message).parentElement!
    // O padding do contêiner é o mesmo 40 de 309:49 (x=40) — se ele mudar, a
    // conta abaixo deixa de valer e este teste tem de ser refeito com o frame.
    expect(container.className).toContain('px-40')

    expect(CARD_PADDING + emptyMessageToken() + CARD_PADDING).toBe(CARD_WIDTH)
  })

  it('pendura a largura no token, nunca num literal (make audit-tokens)', () => {
    render(<Empty copy={EMPTY_STATES.DRE} actionHref="/novo-lancamento" />)

    expect(screen.getByText(EMPTY_STATES.DRE.message).className).toContain(
      'max-w-[var(--width-empty-message)]',
    )
  })
})
