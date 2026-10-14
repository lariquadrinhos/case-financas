import { describe, expect, it } from 'vitest'
import { asId, cents, type InstallmentId, type LiabilityId } from '@/domain/core'
import type { Installment } from './queries'
import { outstandingBalanceOf, sampleDebtEvolution } from './debt-chart'

/**
 * files_design/08 §3.6 "Evolução da Dívida (Detalhe do Passivo)": for a debt
 * with MORE than 12 parcelas, the chart samples 12 equally-spaced points by
 * index, but "hoje" (the current instalment) is a MANDATORY anchor — it always
 * has to be one of the 12 bars, substituting the nearest INTERNAL sampled
 * index (never the first or last, which anchor the whole debt's start/end).
 * Getting this backwards — anchoring the endpoints instead of "hoje", or
 * letting the substitution land on the first/last bar — silently drops the
 * one bar the person actually opened this screen to check ("onde a dívida
 * está agora").
 */
function makeInstallments(count: number, paidCount: number, amount = 150000): Installment[] {
  const liabilityId = asId<LiabilityId>('liab-1')
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1
    return {
      id: asId<InstallmentId>(`liab-1#${number}`),
      liabilityId,
      number,
      paidDate: null,
      plannedDate: `2026-${String((index % 12) + 1).padStart(2, '0')}-10`,
      plannedAmount: cents(amount),
      status: index < paidCount ? 'Paid' : 'Planned',
      paidAmount: index < paidCount ? cents(amount) : null,
      discarded: false,
    } as Installment
  })
}

/**
 * A amostragem por índice não depende da taxa — estes casos passam 0 para
 * manter a asserção sobre QUAL parcela vira barra, não sobre quanto ela vale.
 * A escala da série tem teste próprio, com os números do frame.
 */
const NO_INTEREST = 0

describe('sampleDebtEvolution — files_design/08 §3.6', () => {
  it('returns one point per instalment, no sampling, when there are 12 or fewer', () => {
    const points = sampleDebtEvolution(makeInstallments(12, 0), NO_INTEREST)
    expect(points).toHaveLength(12)
    expect(points.map((p) => p.number)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1))
  })

  it('samples 12 points by index for more than 12 instalments, anchoring #1 and #N', () => {
    const points = sampleDebtEvolution(makeInstallments(360, 0), NO_INTEREST)
    expect(points).toHaveLength(12)
    expect(points[0]?.number).toBe(1)
    expect(points[11]?.number).toBe(360)
  })

  it('marks "hoje" (parcelas pagas + 1) as isToday when it already coincides with a sampled index', () => {
    // A freshly-registered debt: hoje = parcela 1, which is already índice(0).
    const points = sampleDebtEvolution(makeInstallments(360, 0), NO_INTEREST)
    const todayPoints = points.filter((p) => p.isToday)
    expect(todayPoints).toHaveLength(1)
    expect(todayPoints[0]?.number).toBe(1)
  })

  it('substitutes the nearest INTERNAL sampled index with "hoje" when they do not coincide, never the first or last', () => {
    // 360 instalments, 40 already paid → hoje = parcela 41. The unmodified
    // formula índice(i) = round(1 + i·359/11) never lands on 41 for any
    // i in 0..11, so a substitution must happen — and it must not touch the
    // first bar (parcela 1) or the last (parcela 360), which anchor the
    // debt's start and end.
    const points = sampleDebtEvolution(makeInstallments(360, 40), NO_INTEREST)
    expect(points).toHaveLength(12)
    expect(points[0]?.number).toBe(1)
    expect(points[11]?.number).toBe(360)
    const todayPoints = points.filter((p) => p.isToday)
    expect(todayPoints).toHaveLength(1)
    expect(todayPoints[0]?.number).toBe(41)
    // The inserted index must still be one of the 10 INTERNAL positions.
    const todayPosition = points.findIndex((p) => p.isToday)
    expect(todayPosition).toBeGreaterThan(0)
    expect(todayPosition).toBeLessThan(11)
  })

  it('never substitutes the FIRST anchor (parcela 1) even when "hoje" is numerically closer to it than to any internal sample', () => {
    // 360 instalments, 2 paid → hoje = parcela 3 (0-based index 2). Índice(0)
    // is parcela 1 (distance 2) and índice(1) is parcela ~34 (distance ~31):
    // an UNGUARDED nearest-search would replace the very first bar, erasing
    // the debt's starting point from the chart.
    const points = sampleDebtEvolution(makeInstallments(360, 2), NO_INTEREST)
    expect(points[0]?.number).toBe(1)
    expect(points[0]?.isToday).toBe(false)
    const todayPosition = points.findIndex((p) => p.isToday)
    expect(todayPosition).toBeGreaterThan(0)
    expect(points[todayPosition]?.number).toBe(3)
  })

  it('anchors "hoje" at the last bar when the debt is already quitada', () => {
    const points = sampleDebtEvolution(makeInstallments(360, 360), NO_INTEREST)
    const todayPoints = points.filter((p) => p.isToday)
    expect(todayPoints).toHaveLength(1)
    expect(todayPoints[0]?.number).toBe(360)
  })

  it('Figma 91:2 nó 91:63 — a série sai do valor original da dívida, não da soma nominal das parcelas', () => {
    // O cenário desenhado no frame: R$ 320.000,00 em 360 parcelas a 0,85% a.m.,
    // que por Price dão parcelas de R$ 2.855,64. A barra Ago/25 (`91:63`, a mais
    // alta, 120px) representa o valor original e a série cai até zero; somando
    // as parcelas sem descontar, a primeira barra valia R$ 1.025.174,00 — 3,2×
    // a escala que o frame desenha, com o eixo inteiro na ordem de grandeza
    // errada.
    const points = sampleDebtEvolution(makeInstallments(360, 0, 285564), 0.0085)
    expect(points[0]!.balance).toBeLessThanOrEqual(32_000_000)
    expect(points[0]!.balance).toBeGreaterThan(31_000_000)
    expect(points[11]!.balance).toBe(0)
  })

  it('returns an empty chart for a debt with no instalments', () => {
    expect(sampleDebtEvolution([], NO_INTEREST)).toEqual([])
  })
})

describe('outstandingBalanceOf — "Saldo devedor atual" (Figma `91:2` nó `91:50`)', () => {
  it('Figma 91:2 nó 91:104/91:145 — 348 parcelas de R$ 1.520,00 a 0,80% a.m. fecham nos R$ 178.400,00 desenhados', () => {
    // A soma nominal das mesmas 348 daria R$ 528.960,00 — 1,65× o "Valor
    // original R$ 320.000,00" impresso ao lado, no mesmo card `338:2`.
    const balance = outstandingBalanceOf(makeInstallments(360, 12, 152000), 0.008)

    expect(balance).toBe(17_812_897)
    expect(Math.abs(balance - 17_840_000) / 17_840_000).toBeLessThan(0.002)
  })

  it('ignora as parcelas já Pagas', () => {
    expect(outstandingBalanceOf(makeInstallments(3, 3), 0.008)).toBe(0)
  })
})
