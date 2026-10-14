import { describe, expect, it } from 'vitest'
import { asId, cents, isoDate } from '@/domain/core'
import type { LiabilityId } from '@/domain/core'
import { applyRateAdjustment, buildInstallmentSchedule, outstandingBalance } from '@/domain/assets'
import type { Liability } from '@/domain/assets'

/**
 * A validação de engenharia que o hotspot H11 pede.
 *
 * O PRD §5 exige que "a fórmula de amortização e de juros seja validada por
 * Engenharia e por quem responde pela parte financeira", e a nota de design
 * `164:4` diz por quê: "um erro aqui mostra saldo devedor errado pra pessoa".
 * A P3 fechou a ESCOLHA do método (Price, produto, 2026-09-08); ninguém tinha
 * conferido se a implementação calcula Price direito.
 *
 * Esta suíte é a metade que engenharia pode fechar sozinha. Ela NÃO substitui a
 * conferência de quem responde pelo financeiro — o método em si, e se Price é o
 * que o contrato de cada dívida usa, continua sendo pergunta para fora daqui.
 *
 * O método é confrontar a forma fechada com um caminho de cálculo que não
 * compartilha código com ela: a simulação mês a mês `saldo × (1 + i) − parcela`.
 * Se as duas concordam, a fórmula está certa; se divergem, uma das duas está.
 */

function divida(pv: number, n: number, i: number, pagas = 0): Liability {
  return {
    id: asId<LiabilityId>('divida-validacao'),
    name: 'Dívida de Validação',
    creditor: 'Credor Sintético',
    entity: 'PF',
    classification: 'NonCurrent',
    originalAmount: cents(pv),
    installmentAmount: cents(0),
    installmentCount: n,
    installmentsAlreadyPaid: pagas,
    monthlyInterestRate: i,
    startDate: isoDate('2026-01-10'),
  }
}

/** Caminho independente: nenhuma linha em comum com `priceInstallmentFactor`. */
function simular(pv: number, i: number, parcelas: readonly number[]): number {
  let saldo = pv
  for (const parcela of parcelas) saldo = saldo * (1 + i) - parcela
  return saldo
}

/** Price fechada, escrita de novo aqui de propósito — conferir contra si mesmo não confere nada. */
function pmtExata(pv: number, i: number, n: number): number {
  return i === 0 ? pv / n : (pv * i) / (1 - Math.pow(1 + i, -n))
}

/**
 * O teto teórico do resíduo quando cada parcela é arredondada a centavo inteiro.
 *
 * O erro por parcela é no máximo meio centavo, e ele rende juros até o fim:
 * `0,5 × [((1+i)^n − 1) / i]`. Este é o número que separa "arredondamento",
 * que é inevitável em dinheiro inteiro, de "fórmula errada", que não é.
 */
function tetoDoArredondamento(i: number, n: number): number {
  return i === 0 ? 0.5 * n : 0.5 * ((Math.pow(1 + i, n) - 1) / i)
}

const CASOS = [
  { nome: 'financiamento de 320k em 360x a 0,80%', pv: 32_000_000, n: 360, i: 0.008 },
  { nome: 'o mesmo a 0,85%', pv: 32_000_000, n: 360, i: 0.0085 },
  { nome: '10k em 12x a 1,00%', pv: 1_000_000, n: 12, i: 0.01 },
  { nome: '50k em 48x a 1,50%', pv: 5_000_000, n: 48, i: 0.015 },
  { nome: 'sem juros', pv: 300_000, n: 3, i: 0 },
]

describe('H11 — a amortização confere com um cálculo independente', () => {
  it.each(CASOS)('$nome — a parcela gerada é a PMT de Price', ({ pv, n, i }) => {
    const parcelas = buildInstallmentSchedule(divida(pv, n, i)).map(
      (p) => p.plannedAmount as number,
    )
    const exata = pmtExata(pv, i, n)

    // `splitEvenly` distribui o resto do arredondamento, então as parcelas
    // diferem entre si em no máximo um centavo (ADR-0001 §5).
    for (const parcela of parcelas) expect(Math.abs(parcela - exata)).toBeLessThanOrEqual(1)
  })

  it.each(CASOS)('$nome — a PMT exata zera a dívida na simulação mês a mês', ({ pv, n, i }) => {
    const residuo = simular(pv, i, Array<number>(n).fill(pmtExata(pv, i, n)))
    // Precisão de máquina: a forma fechada e a simulação são a mesma conta.
    expect(Math.abs(residuo)).toBeLessThan(0.001)
  })

  it.each(CASOS)('$nome — o resíduo real cabe no teto do arredondamento', ({ pv, n, i }) => {
    const parcelas = buildInstallmentSchedule(divida(pv, n, i)).map(
      (p) => p.plannedAmount as number,
    )
    const residuo = Math.abs(simular(pv, i, parcelas))
    // Medido em 2026-09-11: 535 de 1038 (0,80%) e 537 de 1180 (0,85%). O que
    // este teste impede é a fórmula deixar de ser Price sem ninguém ver — aí o
    // resíduo salta ordens de grandeza, não uns centavos.
    expect(residuo).toBeLessThanOrEqual(tetoDoArredondamento(i, n))
  })

  it.each(CASOS)('$nome — o saldo devedor no dia zero é o valor original', ({ pv, n, i }) => {
    const schedule = buildInstallmentSchedule(divida(pv, n, i))
    expect(Math.abs(outstandingBalance(schedule, i) - pv)).toBeLessThanOrEqual(n)
  })
})

describe('H11 — o reajuste de juros não mexe no principal', () => {
  const REAJUSTES = [
    { nome: '0,80% → 0,85%', pv: 32_000_000, n: 360, i: 0.008, novo: 0.0085, pagas: 12 },
    {
      nome: '0,85% → 0,80% (para baixo)',
      pv: 32_000_000,
      n: 360,
      i: 0.0085,
      novo: 0.008,
      pagas: 12,
    },
    { nome: '1,50% → 2,00%', pv: 5_000_000, n: 48, i: 0.015, novo: 0.02, pagas: 6 },
    { nome: '1,00% → 0% (o limite)', pv: 1_000_000, n: 12, i: 0.01, novo: 0, pagas: 3 },
  ]

  /**
   * Reajustar a taxa muda o que se paga por mês, nunca o quanto se deve hoje.
   * É a invariante que o card "Saldo devedor atual" e o gráfico da Evolução da
   * Dívida dependem: se ela quebrar, o número muda sozinho quando a pessoa
   * registra um reajuste, e nada na tela explica por quê.
   */
  it.each(REAJUSTES)('$nome', ({ pv, n, i, novo, pagas }) => {
    const liability = divida(pv, n, i, pagas)
    const antes = buildInstallmentSchedule(liability)
    const saldoAntes = outstandingBalance(antes, i)

    const { installments: depois } = applyRateAdjustment(liability, antes, {
      liabilityId: liability.id,
      newRate: novo,
      effectiveFrom: isoDate('2026-01-10'),
    })

    // Medido em 2026-09-11: diferença de 0 a 34 centavos em 348 parcelas.
    expect(Math.abs(outstandingBalance(depois, novo) - saldoAntes)).toBeLessThanOrEqual(n)
  })
})
