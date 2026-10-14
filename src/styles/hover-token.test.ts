import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `--color-bg-hover` (2026-10-01): o fundo de hover de todo controle. Nasceu
 * porque o hover usava `--color-bg-subtle`, que no claro é 1,09:1 contra o
 * card — o dono não via a transição. Este teste fixa que o token existe nos
 * três blocos de tema e é perceptível contra card E subtle (≥ 1,15:1).
 */
const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8')

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!)
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}
function block(name: string): string {
  const start = css.indexOf(name)
  return css.slice(start, css.indexOf('\n}', start))
}
function token(scope: string, name: string): string {
  const m = block(scope).match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!m) throw new Error(`${name} ausente em ${scope}`)
  return m[1]!
}

describe('tokens.css — --color-bg-hover', () => {
  it.each([':root {', '@media (prefers-color-scheme: dark)', "[data-theme='dark']"])(
    '%s define bg-hover perceptível contra bg-card e bg-subtle',
    (scope) => {
      const hover = token(scope, 'bg-hover')
      expect(contrast(hover, token(scope, 'bg-card'))).toBeGreaterThanOrEqual(1.15)
      expect(contrast(hover, token(scope, 'bg-subtle'))).toBeGreaterThanOrEqual(1.15)
    },
  )

  it('globals.css expõe o token ao Tailwind como bg-surface-hover', () => {
    const globals = readFileSync(resolve(__dirname, 'globals.css'), 'utf8')
    expect(globals).toContain('--color-surface-hover: var(--color-bg-hover)')
  })
})
