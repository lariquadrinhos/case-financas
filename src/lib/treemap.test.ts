import { describe, expect, it } from 'vitest'
import { cents } from '@/domain/core'
import {
  MAX_VISIBLE_BLOCKS,
  MIN_BLOCK_AREA_SHARE,
  isOthersBlock,
  prepareTreemapItems,
  rampStep,
  squarifyTreemap,
  stripWidth,
} from './treemap'

/**
 * files_design/08 §2.5 — a fórmula da rampa por ranking, com exemplos dados
 * literalmente no doc: "N=6 → 1,2,3,4,5,6 · N=5 → 1,2,4,5,6 · N=3 → 1,4,6 ·
 * N=2 → 1,6". Esta é uma das duas inversões verificadas do grupo Sidebar +
 * Home: a fórmula foi trocada de propósito por "os N primeiros passos"
 * (`Math.min(step, total)` em vez de espalhar por `5 / (N-1)`), o teste ficou
 * vermelho pros casos N=3 e N=2 (que passariam a dar 1,2,3 e 1,2 em vez de
 * 1,4,6 e 1,6), e a fórmula original foi restaurada.
 */
describe('rampStep — files_design/08 §2.5', () => {
  it('espalha os 6 passos pela rampa inteira, nunca só os N primeiros', () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => rampStep(i, 6))).toEqual([1, 2, 3, 4, 5, 6])
    expect([0, 1, 2, 3, 4].map((i) => rampStep(i, 5))).toEqual([1, 2, 4, 5, 6])
    expect([0, 1, 2].map((i) => rampStep(i, 3))).toEqual([1, 4, 6])
    expect([0, 1].map((i) => rampStep(i, 2))).toEqual([1, 6])
  })

  it('usa o passo 1 quando há um item só (passo(0) = 1 quando N = 1)', () => {
    expect(rampStep(0, 1)).toBe(1)
  })
})

describe('prepareTreemapItems — files_design/08 §2.2, §2.7, §2.8', () => {
  const item = (id: string, value: number) => ({ id, name: id, value: cents(value) })

  it('ordena decrescente por valor', () => {
    const result = prepareTreemapItems([item('a', 100), item('b', 300), item('c', 200)])
    expect(result.map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })

  it('omite item de valor zero', () => {
    const result = prepareTreemapItems([item('a', 100), item('zero', 0)])
    expect(result.map((i) => i.id)).toEqual(['a'])
  })

  // §2.8 ("valor zero não entra") lido junto com o §1 (bloco omite centavos).
  // Medido em 2026-09-23: uma conta com R$ 0,03 passava pelo filtro de zero,
  // ganhava o piso de 6,5% do §2.10 — a mesma área de uma conta de R$ 2.128 —
  // e escrevia "R$ 0". Para o bloco, abaixo de R$ 0,50 o valor É zero.
  it('omite item que o bloco escreveria como "R$ 0" (§2.8 + §1)', () => {
    const result = prepareTreemapItems([item('a', 100_00), item('tres', 3), item('quase', 49)])
    expect(result.map((i) => i.id)).toEqual(['a'])
  })

  it('mantém item a partir de R$ 0,50, que o bloco já escreve como "R$ 1"', () => {
    const result = prepareTreemapItems([item('a', 100_00), item('meio', 50)])
    expect(result.map((i) => i.id)).toEqual(['a', 'meio'])
  })

  it('descarta item de valor negativo (erro de dado, nunca desenhado)', () => {
    const result = prepareTreemapItems([item('a', 100), item('negativo', -50)])
    expect(result.map((i) => i.id)).toEqual(['a'])
  })

  it('agrupa o excedente do 7º item em diante em "Outras"', () => {
    const items = Array.from({ length: 8 }, (_, i) => item(`c${i}`, (8 - i) * 100))
    const result = prepareTreemapItems(items)
    expect(result).toHaveLength(MAX_VISIBLE_BLOCKS)
    const others = result[result.length - 1]!
    expect(isOthersBlock(others.id)).toBe(true)
    // 8 itens, top 5 (R$ 8,7,6,5,4) formam os 5 primeiros blocos; os 3
    // menores (c5=3, c6=2, c7=1) somam R$ 6 em "Outras" (§2.7: 6º bloco em
    // diante). Em reais, não centavos: abaixo de R$ 0,50 o item nem entra (§2.8).
    expect(others.value).toBe(6_00)
  })
})

describe('squarifyTreemap — files_design/08 §2.1, §2.3, §2.4', () => {
  it('preenche o contêiner inteiro, sem sobra na borda externa', () => {
    const items = [
      { id: 'a', name: 'a', value: cents(600) },
      { id: 'b', name: 'b', value: cents(400) },
    ]
    const rects = squarifyTreemap(items, 200, 100)
    const minX = Math.min(...rects.map((r) => r.x))
    const maxX = Math.max(...rects.map((r) => r.x + r.w))
    const minY = Math.min(...rects.map((r) => r.y))
    const maxY = Math.max(...rects.map((r) => r.y + r.h))
    expect(minX).toBe(0)
    expect(minY).toBe(0)
    expect(maxX).toBe(200)
    expect(maxY).toBe(100)
  })

  it('um item só ocupa o contêiner inteiro (§2.8)', () => {
    const rects = squarifyTreemap([{ id: 'a', name: 'a', value: cents(500) }], 150, 80)
    expect(rects).toHaveLength(1)
    expect(rects[0]).toMatchObject({ x: 0, y: 0, w: 150, h: 80 })
  })

  it('nenhum item quando a lista está vazia (§2.8)', () => {
    expect(squarifyTreemap([], 100, 100)).toEqual([])
  })

  // §2.8, linha "soma zero": "tratar como nenhum item". A versão anterior deste
  // teste passava uma lista VAZIA e dizia testar a soma zero — batia na guarda
  // `items.length === 0` e continuaria verde mesmo se a guarda `total <= 0`
  // fosse apagada, ou seja, não podia falhar pela regra que nomeava.
  it('soma zero é tratada como "nenhum item", mesmo com itens na lista (§2.8)', () => {
    const items = [
      { id: 'a', name: 'a', value: cents(0) },
      { id: 'b', name: 'b', value: cents(0) },
    ]
    expect(squarifyTreemap(items, 100, 100)).toEqual([])
  })

  // §2.3: "a largura acompanha o card" — com largura zero (o primeiro quadro,
  // antes de o contêiner ser medido) não existe retângulo pra desenhar.
  it('não desenha nada enquanto a largura disponível for zero (§2.3)', () => {
    const items = [{ id: 'a', name: 'a', value: cents(500) }]
    expect(squarifyTreemap(items, 0, 210)).toEqual([])
  })
})

/**
 * files_design/08 §2.10 — o piso de área, nascido de um teste com pessoa real
 * em 2026-09-11.
 *
 * Alguém com R$ 200.000 em investimentos e ~R$ 2.000 no resto tinha 99,01% do
 * dinheiro num bloco só, e os outros três saíam com NOVE pixels de largura:
 * inclicáveis pela WCAG 2.5.8 (alvo de 24×24) e cegos pela escada de sacrifício
 * do §2.6, que esconde o rótulo abaixo de 64px. Três lascas em branco.
 *
 * Os números abaixo são os da faixa de ativos: 1018×150, medida no Mockup.
 */
describe('squarifyTreemap — o piso de área (files_design/08 §2.10)', () => {
  const FAIXA = { largura: 1018, altura: 150 }
  const CASO_RELATADO = [
    { id: 'inv', name: 'Investimentos', value: cents(200_000_00) },
    { id: 'nu', name: 'Nubank', value: cents(1_200_00) },
    { id: 'it', name: 'Itaú PJ', value: cents(500_00) },
    { id: 'br', name: 'Bradesco', value: cents(300_00) },
  ]

  it('o caso relatado deixa de produzir blocos de nove pixels de largura', () => {
    const rects = squarifyTreemap(CASO_RELATADO, FAIXA.largura, FAIXA.altura)
    const menorLargura = Math.min(...rects.map((r) => r.w))

    // 64 é onde a escada do §2.6 volta a mostrar o nome — o alvo do piso não é
    // só poder clicar, é saber no que se está clicando.
    expect(menorLargura).toBeGreaterThanOrEqual(64)
  })

  it('o piso mexe na ÁREA e nunca no valor — o bloco segue escrevendo a verdade', () => {
    const rects = squarifyTreemap(CASO_RELATADO, FAIXA.largura, FAIXA.altura)
    const bradesco = rects.find((r) => r.id === 'br')

    // A área foi inflada de 0,15% para 6,5%; o número não.
    expect(bradesco?.value).toBe(300_00)
  })

  it('não mexe em nada quando os dados já são equilibrados', () => {
    const equilibrado = [
      { id: 'a', name: 'A', value: cents(40_000_00) },
      { id: 'b', name: 'B', value: cents(30_000_00) },
      { id: 'c', name: 'C', value: cents(20_000_00) },
      { id: 'd', name: 'D', value: cents(10_000_00) },
    ]
    const rects = squarifyTreemap(equilibrado, FAIXA.largura, FAIXA.altura)

    // 40/30/20/10 de 1018, com as folgas de 2px entre os quatro.
    expect(rects.map((r) => r.w)).toEqual([406, 304, 201, 101])
  })

  it('o maior bloco continua sendo o maior, e por larga margem', () => {
    const rects = squarifyTreemap(CASO_RELATADO, FAIXA.largura, FAIXA.altura)
    const [maior, ...resto] = rects

    // A ordem por valor (§2.2) não pode ser invertida pelo piso.
    for (const r of resto) expect(maior!.w * maior!.h).toBeGreaterThan(r.w * r.h)
  })

  it('o piso é sempre possível dentro do limite de seis blocos (§2.7)', () => {
    expect(MIN_BLOCK_AREA_SHARE * MAX_VISIBLE_BLOCKS).toBeLessThan(1)
  })

  it('continua preenchendo o contêiner inteiro, sem sobra', () => {
    const rects = squarifyTreemap(CASO_RELATADO, FAIXA.largura, FAIXA.altura)
    expect(Math.max(...rects.map((r) => r.x + r.w))).toBe(FAIXA.largura)
    expect(Math.max(...rects.map((r) => r.y + r.h))).toBe(FAIXA.altura)
  })
})

/**
 * files_design/08 §2.3 + §2.11 — a largura da faixa de dívidas.
 *
 * Medido em 2026-09-23: dívida de 2,4% dos ativos numa faixa de 1046px dava
 * 25px de largura — abaixo dos 64 do §2.6, o bloco saía liso: uma caixa vazia
 * sob "O que você deve", o mesmo "bloco cego" que o §2.10 corrigiu na área.
 */
describe('stripWidth — a faixa proporcional nunca fica ilegível (files_design/08 §2.11)', () => {
  it('abaixo do mínimo, a faixa sobe até a largura que mostra nome, valor e seta', () => {
    expect(stripWidth(1046, 0.024, 120)).toBe(120)
  })

  it('acima do mínimo, continua proporcional (§2.3)', () => {
    expect(stripWidth(1000, 0.5, 120)).toBe(500)
  })

  it('nunca passa da largura disponível, mesmo com dívida maior que os ativos (§2.3)', () => {
    expect(stripWidth(1000, 3, 120)).toBe(1000)
  })

  it('numa tela mais estreita que o mínimo, ocupa só o que existe', () => {
    expect(stripWidth(100, 0.01, 120)).toBe(100)
  })

  it('não desenha nada enquanto a largura disponível for zero', () => {
    expect(stripWidth(0, 0.5, 120)).toBe(0)
  })
})
