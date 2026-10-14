/**
 * Pure logic behind the two numbers the Detalhe do Passivo derives from the
 * schedule — "Saldo devedor atual" (Figma `91:2` nó `91:50`) and the series of
 * "Evolução da Dívida" (nó `91:59`, files_design/08 §3.6). No fetch, no React:
 * the discount rule and the anchoring rule below are exactly the kind of thing
 * that silently regresses under refactor, so they live here, unit-tested, and
 * in ONE copy — the card and the chart must not drift into two definitions of
 * saldo devedor.
 */

import { type Cents, cents } from '@/domain/core'
import type { Installment } from './queries'

export interface DebtChartPoint {
  readonly number: number
  readonly date: string
  readonly balance: Cents
  readonly status: Installment['status']
  /** The instalment "hoje" — parcelas pagas + 1, or the last one if quitada. */
  readonly isToday: boolean
}

function byNumber(installments: readonly Installment[]): Installment[] {
  return [...installments].sort((a, b) => a.number - b.number)
}

/**
 * Principal a stream of instalments still pays off: `Σ parcela_k / (1+i)^k`.
 * Mirrors `presentValueOfStream` in `@/domain/assets`, on the plain wire shape.
 */
function presentValue(amounts: readonly number[], monthlyInterestRate: number): number {
  let total = 0
  for (let k = 0; k < amounts.length; k += 1) {
    total += amounts[k]! / Math.pow(1 + monthlyInterestRate, k + 1)
  }
  return total
}

/**
 * "Saldo devedor atual" (Figma `91:2` nó `91:50`) — o principal ainda em aberto.
 *
 * NÃO é a soma nominal do que resta: o frame desenha R$ 178.400,00 ao lado de
 * "Valor original R$ 320.000,00" (nó `91:47`), no mesmo card `338:2`, com
 * "12 / 360 pagas" (`91:56`) e parcela de R$ 1.520,00 (`91:104`) — somar as 348
 * restantes daria R$ 528.960,00, maior que a dívida contraída. O valor presente
 * delas à taxa de cadastro 0,80% a.m. (`91:145`) dá R$ 178.128,97, 0,15% do
 * número desenhado.
 */
export function outstandingBalanceOf(
  installments: readonly Installment[],
  monthlyInterestRate: number,
): Cents {
  return cents(
    Math.round(
      presentValue(
        byNumber(installments)
          .filter((installment) => installment.status === 'Planned')
          .map((installment) => installment.plannedAmount),
        monthlyInterestRate,
      ),
    ),
  )
}

/**
 * "Saldo devedor" at each point, ascending by parcela — the PRINCIPAL that
 * remains once THAT instalment is settled (files_design/08 §3.6, mirroring
 * `@/domain/assets` `outstandingBalanceOverTime`, re-derived here on the plain
 * wire shape rather than round-tripping through branded domain types the
 * frontend groups do not construct — CLAUDE.md §5 keeps `src/domain` shared,
 * owned code).
 *
 * Descontado à taxa do passivo, não somado nominalmente: Figma `91:2` ancora a
 * primeira barra (`91:63`, Ago/25, 120px) no "Valor original R$ 320.000,00"
 * (`91:47`) e a última mostrada (Jul/26, 67,2px) no "Saldo devedor atual
 * R$ 178.400,00" (`91:50`) — razão 0,560 contra 178.400/320.000 = 0,5575. Somar
 * as parcelas sem descontar punha a barra Ago/25 em R$ 1.025.174,00, 3,2× a
 * escala desenhada.
 */
function balancesAscending(sorted: readonly Installment[], monthlyInterestRate: number): Cents[] {
  const balances: Cents[] = []
  // Float até o ponto ser emitido, como em `outstandingBalanceOverTime`: 360
  // arredondamentos encadeados deslocariam a série inteira.
  let running = 0
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    balances[i] = cents(Math.round(running))
    running = (running + sorted[i]!.plannedAmount) / (1 + monthlyInterestRate)
  }
  return balances
}

/** 0-based index of "hoje": parcelas pagas + 1, or the last instalment when quitada. */
function todayIndexOf(sorted: readonly Installment[]): number {
  const paidCount = sorted.filter((installment) => installment.status === 'Paid').length
  return Math.min(paidCount, sorted.length - 1)
}

const SAMPLE_SIZE = 12

/**
 * files_design/08 §3.6: `índice(i) = round(1 + i·(N−1)/11)` for `i` 0..11,
 * 1-based parcela numbers — converted to 0-based array indices here.
 */
function sampledIndices(total: number): number[] {
  return Array.from({ length: SAMPLE_SIZE }, (_, i) => {
    const oneBasedNumber = Math.round(1 + (i * (total - 1)) / (SAMPLE_SIZE - 1))
    return oneBasedNumber - 1
  })
}

export function sampleDebtEvolution(
  installments: readonly Installment[],
  monthlyInterestRate: number,
): DebtChartPoint[] {
  if (installments.length === 0) return []

  const sorted = byNumber(installments)
  const balances = balancesAscending(sorted, monthlyInterestRate)
  const todayIndex = todayIndexOf(sorted)

  const toPoint = (index: number): DebtChartPoint => {
    const installment = sorted[index]!
    return {
      number: installment.number,
      date: installment.plannedDate,
      balance: balances[index]!,
      status: installment.status,
      isToday: index === todayIndex,
    }
  }

  if (sorted.length <= SAMPLE_SIZE) {
    return sorted.map((_, index) => toPoint(index))
  }

  const indices = sampledIndices(sorted.length)

  // The two endpoints (parcela 1 and parcela N) anchor the whole debt's start
  // and end and are NEVER substituted (files_design/08 §3.6) — only an
  // INTERNAL position (1..10) can be replaced by "hoje".
  if (!indices.includes(todayIndex)) {
    let bestPosition = 1
    let bestDistance = Math.abs(indices[1]! - todayIndex)
    for (let position = 2; position <= SAMPLE_SIZE - 2; position += 1) {
      const distance = Math.abs(indices[position]! - todayIndex)
      if (distance < bestDistance) {
        bestDistance = distance
        bestPosition = position
      }
    }
    indices[bestPosition] = todayIndex
    indices.sort((a, b) => a - b)
  }

  return indices.map((index) => toPoint(index))
}
