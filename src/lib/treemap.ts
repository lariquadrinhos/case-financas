/**
 * Treemap — squarified layout, ranking and the colour ramp formula.
 *
 * files_design/08 §2. Pure, framework-free functions so the algorithm is
 * unit-testable on its own; `src/components/patterns/treemap.tsx` only
 * renders what this module computes. No charting library is used on purpose
 * (CLAUDE.md / ADR-0009 §5: "sem biblioteca de gráfico, o treemap é SVG
 * próprio, seguindo o algoritmo do doc08") — this is a hand-written
 * implementation of the same squarified algorithm `d3-hierarchy` documents.
 */

import { type Cents, ZERO, add, isNegative, isZero } from '@/domain/core'
import { log } from '@/lib/log'

export interface TreemapItem {
  readonly id: string
  readonly name: string
  readonly value: Cents
}

export interface TreemapRect extends TreemapItem {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  /** 1-based rank in the (already sorted, capped) list — drives the colour ramp. */
  readonly rank: number
}

/** §2.7: at most 6 visible blocks; the rest sum into one "Outras". */
export const MAX_VISIBLE_BLOCKS = 6
const OTHERS_ID = '__outras__'

/**
 * §2.8 + §1: o bloco omite centavos, então abaixo de R$ 0,50 ele escreveria
 * "R$ 0" — para o treemap, isso é valor zero. Medido em 2026-09-23: uma conta
 * com R$ 0,03 passava pelo filtro de zero, ganhava o piso de 6,5% do §2.10 (a
 * mesma área de uma conta de R$ 2.128) e escrevia "R$ 0".
 */
const SMALLEST_DRAWN_VALUE = 50

/**
 * §2.2 (decrescente por valor) + §2.7 (limite de 6, excedente em "Outras") +
 * §2.8 (item de valor zero/negativo não entra na área — zero é omitido aqui,
 * negativo é erro de dado e é reportado, nunca desenhado).
 */
export function prepareTreemapItems(
  items: readonly TreemapItem[],
  othersLabel = 'Outras',
): TreemapItem[] {
  const valid: TreemapItem[] = []
  for (const item of items) {
    if (isNegative(item.value)) {
      log.warn('treemap.negative_value_reported', { itemId: item.id })
      continue
    }
    if (isZero(item.value) || item.value < SMALLEST_DRAWN_VALUE) continue
    valid.push(item)
  }

  const sorted = [...valid].sort((a, b) => b.value - a.value)
  if (sorted.length <= MAX_VISIBLE_BLOCKS) return sorted

  const head = sorted.slice(0, MAX_VISIBLE_BLOCKS - 1)
  const tail = sorted.slice(MAX_VISIBLE_BLOCKS - 1)
  const othersTotal = add(...tail.map((item) => item.value))
  return [...head, { id: OTHERS_ID, name: othersLabel, value: othersTotal }]
}

/**
 * §2.3 + §2.11: a largura de uma faixa proporcional (a de dívidas), em px.
 * Proporcional à faixa de referência e limitada a ela, mas nunca abaixo de
 * `minWidth` — medido em 2026-09-23, uma dívida de 2,4% dos ativos dava 25px
 * numa faixa de 1046, e abaixo de 64 o §2.6 esconde tudo: uma caixa vazia.
 * Numa tela mais estreita que o mínimo, fica com o que existe.
 */
export function stripWidth(available: number, ratio: number, minWidth = 0): number {
  if (available <= 0) return 0
  const proportional = available * Math.min(1, Math.max(0, ratio))
  return Math.floor(Math.min(available, Math.max(proportional, minWidth)))
}

export function isOthersBlock(id: string): boolean {
  return id === OTHERS_ID
}

/**
 * §2.5: the ramp step by RANK, spread across all six steps rather than the
 * first N — `passo(i) = round(1 + i * 5 / (N - 1))`, `passo(0) = 1` when N = 1.
 * `i` is 0-based here; callers pass `rank - 1`.
 */
export function rampStep(zeroBasedIndex: number, total: number): 1 | 2 | 3 | 4 | 5 | 6 {
  if (total <= 1) return 1
  const step = Math.round(1 + (zeroBasedIndex * 5) / (total - 1))
  return Math.min(6, Math.max(1, step)) as 1 | 2 | 3 | 4 | 5 | 6
}

/* -------------------------------------------------------------------------
 * Squarified layout
 * ---------------------------------------------------------------------- */

interface Areaed extends TreemapItem {
  area: number
}

function worstRatio(row: readonly Areaed[], side: number): number {
  const sum = row.reduce((total, item) => total + item.area, 0)
  const max = Math.max(...row.map((item) => item.area))
  const min = Math.min(...row.map((item) => item.area))
  if (side === 0 || sum === 0 || min === 0) return Infinity
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min))
}

interface FloatRect extends Areaed {
  x: number
  y: number
  w: number
  h: number
}

function layoutRow(
  children: readonly Areaed[],
  x: number,
  y: number,
  w: number,
  h: number,
  out: FloatRect[],
): void {
  if (children.length === 0) return
  if (children.length === 1) {
    const item = children[0] as Areaed
    out.push({ ...item, x, y, w, h })
    return
  }

  const shortSide = Math.min(w, h)
  let splitAt = 1
  let row = children.slice(0, splitAt)
  while (splitAt < children.length) {
    const next = children.slice(0, splitAt + 1)
    if (worstRatio(next, shortSide) > worstRatio(row, shortSide)) break
    splitAt += 1
    row = next
  }

  const rowArea = row.reduce((total, item) => total + item.area, 0)
  const remaining = children.slice(splitAt)

  if (w >= h) {
    const stripWidth = h === 0 ? 0 : rowArea / h
    let cy = y
    for (const item of row) {
      const itemHeight = stripWidth === 0 ? 0 : item.area / stripWidth
      out.push({ ...item, x, y: cy, w: stripWidth, h: itemHeight })
      cy += itemHeight
    }
    layoutRow(remaining, x + stripWidth, y, w - stripWidth, h, out)
  } else {
    const stripHeight = w === 0 ? 0 : rowArea / w
    let cx = x
    for (const item of row) {
      const itemWidth = stripHeight === 0 ? 0 : item.area / stripHeight
      out.push({ ...item, x: cx, y, w: itemWidth, h: stripHeight })
      cx += itemWidth
    }
    layoutRow(remaining, x, y + stripHeight, w, h - stripHeight, out)
  }
}

/**
 * §2.10: a fatia mínima de área que um bloco recebe, seja qual for o valor dele.
 *
 * **Medido num teste com pessoa real, em 2026-09-11.** Alguém com R$ 200.000 em
 * investimentos e ~R$ 2.000 espalhado no resto tinha 99,01% do dinheiro num
 * bloco só. Na faixa de 1018×150, o algoritmo puro devolvia:
 *
 *   Investimentos  1007×150      Nubank  9×89      Itaú  9×35      Bradesco  9×22
 *
 * Nove pixels de largura. Inclicável — a WCAG 2.5.8 pede alvo de 24×24 — e
 * ainda por cima cego, porque a escada de sacrifício do §2.6 esconde o rótulo
 * abaixo de 64px de largura. Três lascas em branco.
 *
 * 6,5% é o piso que devolve ~66px nesse caso: passa dos 64 e portanto o bloco
 * VOLTA A MOSTRAR O NOME. Um bloco clicável e cego resolveria metade do
 * problema — a pessoa veria que há algo ali, sem saber o quê.
 *
 * Com seis blocos no máximo (`MAX_VISIBLE_BLOCKS`), o piso nunca é impossível:
 * 6 × 6,5% = 39% do contêiner.
 */
export const MIN_BLOCK_AREA_SHARE = 0.065

/**
 * As fatias de área, com o piso aplicado e a diferença tirada de quem está
 * acima dele, proporcionalmente.
 *
 * Itera porque redistribuir pode empurrar um vizinho para baixo do piso: tirar
 * área dos grandes encolhe todo mundo que estava acima, e um deles pode cruzar
 * a linha. Na prática converge em duas ou três voltas; o limite existe para não
 * depender disso.
 *
 * **O piso mexe na ÁREA, nunca no `value`.** O bloco continua escrevendo o
 * número verdadeiro: é ele que carrega o fato quando a área deixa de carregar.
 * Trocar o valor aqui faria o card mentir por escrito, que é muito pior do que
 * mentir por tamanho.
 */
function areaShares(values: readonly number[], total: number, floor: number): number[] {
  let shares = values.map((value) => value / total)
  if (floor <= 0 || floor * shares.length >= 1) return shares

  for (let volta = 0; volta < 10; volta += 1) {
    const abaixo = shares.map((share) => share < floor)
    if (!abaixo.some(Boolean)) break

    const presos = abaixo.filter(Boolean).length * floor
    const somaLivre = shares.reduce((sum, share, i) => (abaixo[i] ? sum : sum + share), 0)
    if (somaLivre <= 0) return shares.map(() => 1 / shares.length)

    const restante = 1 - presos
    shares = shares.map((share, i) => (abaixo[i] ? floor : (share / somaLivre) * restante))
  }
  return shares
}

/**
 * §2.1 (squarified, not the naive row-slicing algorithm) + §2.3 (fixed
 * container per card) + §2.4 (2px inner gap only, none at the outer edge —
 * achieved by insetting each rect by half the gap except on edges that touch
 * the container border) + §2.10 (piso de área, acima).
 */
export function squarifyTreemap(
  items: readonly TreemapItem[],
  width: number,
  height: number,
  gap = 2,
): TreemapRect[] {
  if (items.length === 0 || width <= 0 || height <= 0) return []
  const total = items.reduce((sum, item) => sum + item.value, 0)
  if (total <= 0) return []

  const containerArea = width * height
  const shares = areaShares(
    items.map((item) => item.value),
    total,
    MIN_BLOCK_AREA_SHARE,
  )
  const scaled: Areaed[] = items.map((item, i) => ({
    ...item,
    area: (shares[i] as number) * containerArea,
  }))

  const floats: FloatRect[] = []
  layoutRow(scaled, 0, 0, width, height, floats)

  const epsilon = 0.01
  return floats.map((rect, index) => {
    const insetLeft = rect.x <= epsilon ? 0 : gap / 2
    const insetTop = rect.y <= epsilon ? 0 : gap / 2
    const insetRight = rect.x + rect.w >= width - epsilon ? 0 : gap / 2
    const insetBottom = rect.y + rect.h >= height - epsilon ? 0 : gap / 2

    const x0 = Math.round(rect.x + insetLeft)
    const y0 = Math.round(rect.y + insetTop)
    const x1 = Math.round(rect.x + rect.w - insetRight)
    const y1 = Math.round(rect.y + rect.h - insetBottom)

    return {
      id: rect.id,
      name: rect.name,
      value: rect.value as Cents,
      x: x0,
      y: y0,
      w: Math.max(0, x1 - x0),
      h: Math.max(0, y1 - y0),
      rank: index + 1,
    }
  })
}

export const ZERO_VALUE = ZERO
