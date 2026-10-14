import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MutationError } from './error-state'
import { ApiError } from '@/lib/api-client'

/**
 * A mensagem de erro de escrita NÃO é um componente inventado: a Style guide
 * fecha a forma no component set `Campo` (`460:20`), variante `field/error`
 * (`460:11`) — a única apresentação de erro de todo o sistema (os 12 sets de
 * `383:2` não têm toast, banner, alerta nem snackbar).
 *
 * Geometria literal de `460:11` (240×88, contra 240×64 das outras 3 variantes):
 *   - `460:12` rótulo ............ x0  y0  240×18
 *   - `460:13` "Caixa" ........... x0  y24 240×40  (termina em y=64)
 *   - `460:15` mensagem de erro .. x0  y70 **240**×18
 *
 * Os 240 de 240 são o fato desta suíte: a mensagem ocupa a largura INTEIRA do
 * controle — não os 112 do texto que mora dentro da caixa (`460:14`). Quem
 * declara essa largura é o componente, como em `field/error`; antes desta
 * correção ela vinha de um `className="w-full"` repetido à mão em 3 das 4
 * páginas de onboarding e ausente nas outras 3 chamadas, então a largura real
 * mudava de página para página sem decisão nenhuma por trás.
 *
 * Regra escrita correspondente: files_design/07-style-guide.md:296 — "Erro …
 * adiciona uma linha de mensagem abaixo em `color/text/negative`".
 */
describe('MutationError — geometria do field/error (Figma 460:11)', () => {
  it('declara a largura cheia do controle (240 de 240 em `460:15`) sem depender do chamador', () => {
    render(<MutationError error={new ApiError(409, null)} />)
    expect(screen.getByRole('alert').className).toContain('w-full')
  })

  it('mantém o par de tokens do `field/error`: body.sm em color/text/negative', () => {
    render(<MutationError error={new ApiError(409, null)} />)
    const alert = screen.getByRole('alert')
    expect(alert.className).toContain('text-style-body-sm')
    expect(alert.className).toContain('text-ink-negative')
  })

  it('não deixa nenhuma página de onboarding redeclarar a largura da mensagem', () => {
    const pages = [
      'src/app/onboarding/contas-bancarias/page.tsx',
      'src/app/onboarding/bens-materiais/page.tsx',
      'src/app/onboarding/investimentos/page.tsx',
      'src/app/onboarding/passivos/page.tsx',
    ]
    const offenders = pages.filter((page) =>
      /<MutationError[^>]*className=/.test(readFileSync(page, 'utf8')),
    )
    expect(offenders).toEqual([])
  })
})
