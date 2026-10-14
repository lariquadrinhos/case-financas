import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Todo campo de dinheiro tem que comportar o maior valor que o produto aceita.
 *
 * O teto é **999 bilhões**, e o número abaixo não é escolha: "R$ 999.000.000.000,00"
 * mede 154px na tipografia do campo, medido no NAVEGADOR em 2026-09-11
 * (`scrollWidth` do input com o teto digitado, diálogo "Editar dados
 * cadastrais" aberto no Chrome). Com os 12px de respiro de cada lado e 1px de
 * borda, o piso é **180** — e 180 é o que os quatro tokens valem, sem folga.
 *
 * O piso era 172, vindo de uma medição no Figma que dava 148px de texto. O
 * navegador desmentiu por 6px: um token em 172 teria passado neste teste e
 * cortado o número em produção. Onde a régua do Figma e a do navegador
 * discordam, quem decide é a que a pessoa vê.
 *
 * Esta é a invariante que interessa, e por isso o teste é sobre os TOKENS, não
 * sobre uma tela: um campo de dinheiro novo vai pegar uma dessas larguras, e
 * quem estreitar qualquer uma delas quebra o portão em vez de cortar um número
 * em produção. Foi assim que `-account` (140) e `-asset` (160) passaram meses
 * cortando valores sem ninguém ver.
 */
const PISO = 180

describe('largura dos campos de dinheiro', () => {
  const css = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8')

  it('nenhum token de campo de dinheiro fica abaixo do que o teto exige', () => {
    const tokens = [...css.matchAll(/--width-field-money-([a-z-]+):\s*(\d+)px/g)].map((m) => ({
      nome: m[1] as string,
      largura: Number(m[2]),
    }))

    // Se a lista esvaziar, o teste passa sem testar nada — trave isso também.
    expect(tokens.length).toBeGreaterThanOrEqual(4)
    expect(tokens.filter((t) => t.largura < PISO)).toEqual([])
  })

  it('o campo "Nome" de cada linha do Onboarding continua fechando a linha de 600', () => {
    const ler = (nome: string) => {
      const m = css.match(new RegExp(`--width-field-${nome}:\\s*(\\d+)px`))
      if (!m) throw new Error(`token --width-field-${nome} não existe`)
      return Number(m[1])
    }
    // Mockup: Nome + 16 + Valor + 16 + Entidade (91) = 600.
    for (const [nome, dinheiro] of [
      ['name-asset', 'money-asset'],
      ['name-investment', 'money-investment'],
    ] as const) {
      expect(ler(nome) + 16 + ler(dinheiro) + 16 + 91).toBe(600)
    }
  })
})
