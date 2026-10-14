import { describe, expect, it } from 'vitest'
import { cents } from '@/domain/core'
import { assetBlocksFrom, liabilityBlocksFrom } from './money-map-card'
import type { BalanceSheet } from '../_lib/queries'

/**
 * files_design/01 §13 ("Onde Está Meu Dinheiro (clicar num bloco): mostra a
 * composição do valor, ex.: Investimentos = Tesouro Direto + Ações XP") +
 * docs/figma/frames/5-2__desktop-inicio-dashboard.xml nó 189:2-8 (um único
 * bloco "Investimentos", legenda "Tesouro, ações") — o treemap tem que
 * mostrar UM bloco "Investimentos" por trás do qual moram os instrumentos,
 * nunca um bloco de nível 1 por instrumento. Contas Bancárias continuam cada
 * uma seu próprio bloco (docs/figma/frames/345-252, nós 347:418 "Nubank
 * (PF)" e 347:425 "Itaú PJ", separados).
 */
function fakeBalanceSheet(): BalanceSheet {
  return {
    view: 'Consolidated',
    asOf: '2026-07-20',
    currentAssets: {
      total: cents(1_796_00),
      items: [
        {
          source: { kind: 'BankAccount', bankAccountId: 'acc-nubank' },
          entity: 'PF',
          label: 'Nubank',
          amount: cents(1_796_00),
        },
      ],
    },
    nonCurrentAssets: {
      total: cents(250_000_00),
      items: [
        {
          source: { kind: 'Investment', investmentId: 'inv-tesouro' },
          entity: 'PF',
          label: 'Tesouro Direto',
          amount: cents(150_000_00),
        },
        {
          source: { kind: 'Investment', investmentId: 'inv-acoes' },
          entity: 'PF',
          label: 'Ações XP',
          amount: cents(100_000_00),
        },
      ],
    },
    currentLiabilities: { total: cents(0), items: [] },
    nonCurrentLiabilities: { total: cents(0), items: [] },
    totalAssets: cents(251_796_00),
    totalLiabilities: cents(0),
    netWorth: cents(251_796_00),
  }
}

describe('Onde Está Meu Dinheiro — Investimentos agregado num único bloco (PRD/files_design/01 §13)', () => {
  it('produz um único bloco "Investimentos" no treemap, não um bloco por instrumento', () => {
    const blocks = assetBlocksFrom(fakeBalanceSheet())

    const investmentBlocks = blocks.filter((block) => block.kind === 'Investment')
    expect(investmentBlocks).toHaveLength(1)
    expect(investmentBlocks[0]?.name).toBe('Investimentos')
    expect(investmentBlocks[0]?.value).toBe(cents(250_000_00))
  })

  it('carrega a composição completa (Tesouro Direto + Ações XP) no bloco agregado', () => {
    const blocks = assetBlocksFrom(fakeBalanceSheet())
    const investmentsBlock = blocks.find((block) => block.kind === 'Investment')

    expect(investmentsBlock?.items.map((item) => item.name)).toEqual(['Tesouro Direto', 'Ações XP'])
    expect(investmentsBlock?.items.map((item) => item.value)).toEqual([
      cents(150_000_00),
      cents(100_000_00),
    ])
  })

  it('mantém cada Conta Bancária como seu próprio bloco (não agrega Contas)', () => {
    const blocks = assetBlocksFrom(fakeBalanceSheet())
    const bankBlocks = blocks.filter((block) => block.kind === 'BankAccount')

    expect(bankBlocks).toHaveLength(1)
    expect(bankBlocks[0]?.name).toBe('Nubank')
  })
})

/**
 * P43 (produto, 2026-09-09) — a faixa de Dívidas agrega, como a de Investimentos.
 *
 * Medido na `Faixa - Dívidas` do Mockup "Desktop — Início dashboard": UM bloco,
 * legenda "Financiamento, cartão" (dois instrumentos) sob um valor único, com o
 * rótulo "Dívidas (Passivos)" cobrindo a faixa inteira. Mesma construção de
 * "Investimentos / Tesouro, ações", que já era agregada — a faixa de baixo é que
 * divergia da de cima, dentro do mesmo card.
 */
describe('Onde Está Meu Dinheiro — a faixa de Dívidas agrega (P43)', () => {
  function comDuasDividas(): BalanceSheet {
    const base = fakeBalanceSheet()
    return {
      ...base,
      nonCurrentLiabilities: {
        total: cents(34_000_00),
        items: [
          {
            source: { kind: 'Liability', liabilityId: 'lia-financiamento' },
            entity: 'PF',
            label: 'Financiamento apartamento',
            amount: cents(24_000_00),
          },
          {
            source: { kind: 'Liability', liabilityId: 'lia-cartao' },
            entity: 'PF',
            label: 'Cartão de crédito',
            amount: cents(10_000_00),
          },
        ],
      },
    }
  }

  it('produz UM bloco somado, não um por dívida', () => {
    const blocos = liabilityBlocksFrom(comDuasDividas())

    expect(blocos).toHaveLength(1)
    expect(blocos[0]?.name).toBe('Dívidas (Passivos)')
    expect(blocos[0]?.value).toBe(cents(34_000_00))
  })

  it('carrega a composição, que é o que o modal do bloco lista', () => {
    const bloco = liabilityBlocksFrom(comDuasDividas())[0]

    expect(bloco?.items.map((i) => i.name)).toEqual([
      'Financiamento apartamento',
      'Cartão de crédito',
    ])
  })

  it('sem dívida nenhuma não desenha faixa', () => {
    expect(liabilityBlocksFrom(fakeBalanceSheet())).toEqual([])
  })
})
