import { describe, expect, it } from 'vitest'
import { BANK_ACCOUNT_COLOURS } from '@/domain/assets'
import {
  suggestedColourFor,
  BANK_ACCOUNT_SWATCHES,
  BANK_EXTRA_SWATCHES,
  BANK_SUGGESTION_SWATCHES,
  bankAccountSwatch,
} from './bank-account-colours'

/**
 * A lista fechada das 6 cores está escrita no Figma, página **Tokens**, nó
 * `1091:2` "Cores de banco (referência)" — uma linha por cor, com bolinha,
 * nome, hex, rgb e fonte — e replicada em files_design/07 §"Cores de banco
 * (referência, fora do sistema de tokens)". A 6ª linha é `1091:5085`, e o
 * texto dela é `1091:5087` = "Cor extra" (não "Outra"): doc02, "C6 Bank saiu
 * da paleta de cores de conta, virou \"Cor extra\" genérica" — «a 6ª cor virou
 * "Cor extra" — um cinza neutro genérico (#6B7280)».
 *
 * O rótulo é texto de interface: vira o `aria-label` da bolinha no
 * ColourSwatchPicker e o texto visível da coluna "Cor" da tabela de contas
 * cadastradas (contas-bancarias.tsx).
 */
describe('BANK_ACCOUNT_SWATCHES — a paleta do Figma Tokens 1091:2', () => {
  /* Em 2026-09-11 a paleta cresceu e se DIVIDIU: a faixa mostra as cinco de
     banco como sugestão, e o cinza deixou a 6ª vaga para o gatilho do color
     pick, passando a viver dentro dele. As cinco primeiras linhas de `1091:2`
     continuam sendo a fonte das sugestões; as extras são decisão nova. */
  /* 2026-09-29, decisão do dono: o rótulo é o TOM, não o banco. Com nome de
     banco, a coluna "Cor" escrevia "Caixa" ao lado de "BTG Pactual" e "Banco
     do Brasil" ao lado de "Itaú" — medido na tela com as contas reais. O slug
     e o hex não mudam: são dado gravado e cor medida. */
  it('a faixa mostra os cinco tons de sugestão, na ordem literal de 1091:5055..1091:5079', () => {
    expect(BANK_SUGGESTION_SWATCHES.map((swatch) => swatch.label)).toEqual([
      'Roxo',
      'Laranja',
      'Azul-escuro',
      'Vermelho',
      'Azul',
    ])
  })

  it('as seis extras fecham no cinza, que é o que já existia', () => {
    expect(BANK_EXTRA_SWATCHES.map((swatch) => swatch.label)).toEqual([
      'Verde',
      'Verde-azulado',
      'Ouro',
      'Rosa',
      'Marrom',
      'Cinza',
    ])
    // O slug do cinza NÃO muda: é dado gravado, e uma conta o usa.
    expect(BANK_EXTRA_SWATCHES.at(-1)!.slug).toBe('outra')
  })

  it('nenhuma cor extra repete um slug de banco', () => {
    const bancos = new Set(BANK_SUGGESTION_SWATCHES.map((s) => s.slug))
    expect(BANK_EXTRA_SWATCHES.filter((s) => bancos.has(s.slug))).toEqual([])
  })

  it('cai no cinza quando o slug gravado não está na paleta', () => {
    expect(bankAccountSwatch('c6').label).toBe('Cinza')
  })

  /* Duas listas, uma fonte: `BANK_ACCOUNT_COLOURS` é o que a borda HTTP aceita
     (`bankAccountColourSchema`) e esta paleta é o que a tela desenha. Se elas
     divergirem, a API aceita um slug que nenhuma bolinha sabe pintar. */
  it('tem exatamente os slugs de BANK_ACCOUNT_COLOURS, na mesma ordem', () => {
    expect(BANK_ACCOUNT_SWATCHES.map((swatch) => swatch.slug)).toEqual([...BANK_ACCOUNT_COLOURS])
  })
})

describe('suggestedColourFor — a mesma cor pelo mesmo nome, manual ou pelo Open Finance', () => {
  it('banco conhecido recebe a cor da marca, sem depender de acento nem de caixa', () => {
    expect(suggestedColourFor('Itaú')).toBe('itau')
    expect(suggestedColourFor('ITAU Uniclass')).toBe('itau')
    expect(suggestedColourFor('Nubank')).toBe('nubank')
    expect(suggestedColourFor('Banco do Brasil')).toBe('banco-do-brasil')
    expect(suggestedColourFor('Bradesco')).toBe('bradesco')
    expect(suggestedColourFor('Caixa Econômica')).toBe('caixa')
    expect(suggestedColourFor('BTG Pactual')).toBe('banco-do-brasil')
  })

  it('banco desconhecido recebe sempre a MESMA cor para o mesmo nome (reconectar dá o mesmo resultado)', () => {
    const primeira = suggestedColourFor('Banco Sintético Qualquer')
    expect(suggestedColourFor('  banco sintético qualquer ')).toBe(primeira)
    expect(BANK_ACCOUNT_COLOURS).toContain(primeira)
  })

  it('nome vazio cai no padrão, que é o pré-selecionado do formulário', () => {
    expect(suggestedColourFor('')).toBe(BANK_ACCOUNT_SWATCHES[0]!.slug)
  })
})
