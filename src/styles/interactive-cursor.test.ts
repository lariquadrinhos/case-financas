import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Pedido do dono, 2026-10-01: "todos os botões precisam ter o dedinho
 * indicando que é um botão e o hover". O Tailwind 4 deixou de dar
 * `cursor: pointer` ao <button> no preflight, então nenhum botão do app
 * mostrava a mãozinha. A regra mora em globals.css, uma vez, para todo
 * controle clicável — não classe a classe, que esquece um.
 */
const css = readFileSync(resolve(__dirname, 'globals.css'), 'utf8')

describe('globals.css — cursor de mãozinha em todo controle clicável', () => {
  it.each([
    'button:not(:disabled)',
    "[role='button']",
    "[role='tab']",
    "[role='radio']",
    "[role='switch']",
    "[role='option']",
    "[role='combobox']",
    'a[href]',
  ])('%s tem cursor: pointer', (selector) => {
    const rule = css.slice(css.indexOf('/* Cursor de mãozinha'))
    const block = rule.slice(0, rule.indexOf('}') + 1)
    expect(block).toContain(selector)
    expect(block).toContain('cursor: pointer')
  })
})
