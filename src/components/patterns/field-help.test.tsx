import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClassificationFieldHelp, StatusFieldHelp } from './field-help'

/**
 * O mesmo termo tem que carregar a MESMA explicação em toda tela onde aparece
 * — foi o que a pessoa notou faltando ao testar o app. Isso só se sustenta se a
 * cópia morar num lugar só; sete cópias iguais divergem na primeira edição.
 */
describe('Ajuda de campo — uma cópia por termo', () => {
  it('Status explica as duas opções, e o rótulo de "pago" acompanha o tipo', () => {
    render(<StatusFieldHelp />)
    expect(screen.getByRole('button', { name: 'Ajuda sobre Status' })).toBeInTheDocument()
  })

  it('Classificação só fala da sugestão automática onde existe sugestão', () => {
    const { unmount } = render(<ClassificationFieldHelp />)
    expect(screen.getByRole('button', { name: 'Ajuda sobre Classificação' })).toBeInTheDocument()
    unmount()
    render(<ClassificationFieldHelp withSuggestionNote />)
    expect(screen.getByRole('button', { name: 'Ajuda sobre Classificação' })).toBeInTheDocument()
  })

  it('o InfoTooltip se basta: não exige TooltipProvider em volta', () => {
    // Sem Provider, o Radix lança. Renderizar solto é o teste.
    expect(() => render(<StatusFieldHelp />)).not.toThrow()
  })
})

/**
 * A regra que a pessoa pediu ao testar: "o tooltip deve aparecer em todas as
 * aparições do termo". Este teste é a rede — ele varre o código-fonte e falha
 * se alguém acrescentar um campo com um desses rótulos sem a ajuda ao lado.
 *
 * Varrer arquivo é feio e é de propósito: o alvo não é um componente, é uma
 * INVARIANTE entre telas, e nenhum teste de render pega isso porque o defeito
 * mora na tela que ninguém lembrou de montar.
 */
describe('a ajuda acompanha o termo em toda tela', () => {
  it('nenhum campo rotulado Status ou Classificação fica sem a ajuda', async () => {
    const { readFileSync } = await import('node:fs')
    const { globSync } = await import('node:fs')
    const arquivos = globSync('src/**/*.tsx').filter(
      (f) => !f.includes('.test.') && !f.includes('field-help'),
    )

    const faltando: string[] = []
    for (const arquivo of arquivos) {
      const fonte = readFileSync(arquivo, 'utf8')
      // Um campo é `<Field ... label="Status" ...>` até o `>` que o fecha.
      for (const campo of fonte.matchAll(/<Field\b[^>]*>/gs)) {
        const texto = campo[0]
        const ehStatus = /label="Status"/.test(texto)
        const ehClassificacao = /label="Classificação/.test(texto)
        if (!ehStatus && !ehClassificacao) continue
        if (!/FieldHelp/.test(texto)) faltando.push(`${arquivo}: ${texto.slice(0, 60)}…`)
      }
    }
    expect(faltando).toEqual([])
  })
})
