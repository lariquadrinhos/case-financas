/**
 * Passivo — amortisation schedule, rate adjustment, outstanding balance and the
 * two trace events a Passivo produces on its own (files_design/01 §12,
 * files_design/03 "Passivos" / "objeto Parcela").
 *
 * These were flagged in the Event Storming as "implemented, no test" (H11,
 * `docs/event-storming/financas-pf-pj.md`) — the amortisation formula is the
 * highest-risk piece of this context, so every test here names the rule it
 * protects, per CLAUDE.md §3.
 */

import { describe, expect, it } from 'vitest'
import { asId, cents, isoDate } from '@/domain/core'
import type { InstallmentId, LiabilityId } from '@/domain/core'
import {
  applyRateAdjustment,
  buildInstallmentSchedule,
  discardInstallment,
  formatMonthlyRate,
  liabilityRegisteredEvent,
  markInstallmentPaid,
  outstandingBalance,
  outstandingBalanceOverTime,
} from './installments'
import type { Installment, Liability } from './types'

/**
 * `Intl` separates "R$" from the digits with a NON-BREAKING space (U+00A0).
 * Same escape as `money.test.ts` `plainSpaces` — comparing against a literal
 * typed with a normal space fails on a difference nobody can see in the diff.
 */
function plainSpaces(text: string): string {
  return text.replace(/ /g, ' ')
}

function liability(overrides: Partial<Liability> = {}): Liability {
  return {
    id: asId<LiabilityId>('l1'),
    name: 'Financiamento apartamento',
    creditor: 'Banco',
    entity: 'PF',
    classification: 'NonCurrent',
    originalAmount: cents(10000),
    // Deliberately absurd: it must NOT feed the schedule. Declared field only —
    // Figma note `164:2`/`164:4` (P3a in docs/PERGUNTAS-EM-ABERTO.md).
    installmentAmount: cents(999999),
    installmentCount: 2,
    installmentsAlreadyPaid: 0,
    monthlyInterestRate: 0.01,
    startDate: isoDate('2026-01-10'),
    ...overrides,
  }
}

describe('buildInstallmentSchedule — Price amortisation (files_design/03 "calculado por amortização")', () => {
  it('at 1% a.m. for 2 months, splits R$ 100,00 into two R$ 50,75 instalments', () => {
    // Hand-computed Price factor: i/(1-(1+i)^-n) at i=0.01, n=2 is
    // 0.5075247885..., so the total repayment is 10000 * 1.0150495771 = 10150,18
    // → rounds to 10150 cents, split evenly into 5075 + 5075.
    const schedule = buildInstallmentSchedule(liability())
    expect(schedule.map((i) => i.plannedAmount)).toEqual([5075, 5075])
  })

  it('P3a (Figma 164:2) — the declared "Valor da parcela" never feeds the calculation', () => {
    const cheap = buildInstallmentSchedule(liability({ installmentAmount: cents(1) }))
    const expensive = buildInstallmentSchedule(liability({ installmentAmount: cents(999_999_999) }))
    expect(cheap.map((i) => i.plannedAmount)).toEqual(expensive.map((i) => i.plannedAmount))
  })

  it('at 0% a.m., splits the principal evenly with no interest at all', () => {
    const schedule = buildInstallmentSchedule(
      liability({ originalAmount: cents(100_000), installmentCount: 4, monthlyInterestRate: 0 }),
    )
    expect(schedule.map((i) => i.plannedAmount)).toEqual([25_000, 25_000, 25_000, 25_000])
  })

  it('the shares always sum back to the rounded total (ADR-0001 §5, splitEvenly)', () => {
    // A rate/count combination chosen to produce a remainder when split.
    const schedule = buildInstallmentSchedule(
      liability({
        originalAmount: cents(100_000),
        installmentCount: 3,
        monthlyInterestRate: 0.007,
      }),
    )
    const total = schedule.reduce((sum, i) => sum + i.plannedAmount, 0)
    // Price total at i=0.007, n=3 rounds to a value not evenly divisible by 3;
    // this assertion is the one that would fail if each row were rounded on its
    // own instead of splitting the pre-rounded total.
    expect(total).toBe(
      schedule[0]!.plannedAmount + schedule[1]!.plannedAmount + schedule[2]!.plannedAmount,
    )
    expect(
      Math.max(...schedule.map((i) => i.plannedAmount)) -
        Math.min(...schedule.map((i) => i.plannedAmount)),
    ).toBeLessThanOrEqual(1)
  })

  it('pre-marks "parcelas já pagas" as Paga, with paidAmount equal to the planned amount', () => {
    const schedule = buildInstallmentSchedule(
      liability({ installmentCount: 4, installmentsAlreadyPaid: 2 }),
    )
    expect(schedule.map((i) => i.status)).toEqual(['Paid', 'Paid', 'Planned', 'Planned'])
    expect(schedule[0]!.paidAmount).toBe(schedule[0]!.plannedAmount)
    expect(schedule[1]!.paidAmount).toBe(schedule[1]!.plannedAmount)
    expect(schedule[2]!.paidAmount).toBeNull()
    expect(schedule[3]!.paidAmount).toBeNull()
  })

  it('numbers installments sequentially from 1 and derives the id from liability + number', () => {
    const schedule = buildInstallmentSchedule(liability({ id: asId<LiabilityId>('financing-1') }))
    expect(schedule.map((i) => i.number)).toEqual([1, 2])
    expect(schedule[0]!.id).toBe('financing-1#1')
    expect(schedule[1]!.id).toBe('financing-1#2')
  })

  it('Figma 91:2 — instalment #1 falls on the start date itself, then monthly after that', () => {
    const schedule = buildInstallmentSchedule(
      liability({ startDate: isoDate('2026-01-31'), installmentCount: 3 }),
    )
    // 31 Jan → 28 Feb (clamped, not-leap) → 31 Mar.
    expect(schedule.map((i) => i.plannedDate)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })

  it('Figma 91:2 — reproduces the four dates the frame prints for the 360-instalment debt', () => {
    // The frame is the whole measurement, node by node: `91:56` "12 / 360 pagas",
    // and the four rows of the card "Parcelas" — `91:101`/`91:103` "#11" /
    // "10/06/2026", `91:109`/`91:111` "#12" / "10/07/2026", `91:117`/`91:119`
    // "#13" / "10/08/2026", `91:125`/`91:127` "#14" / "10/09/2026". Counting
    // #12 = 10/07/2026 back one month at a time puts #1 on 10/08/2025 — the
    // month of the debt's start, which the chart `91:61` confirms independently:
    // 12 bars for the 12 paid instalments, the first labelled `91:64` "Ago/25".
    const schedule = buildInstallmentSchedule(
      liability({
        startDate: isoDate('2025-08-10'),
        installmentCount: 360,
        installmentsAlreadyPaid: 12,
      }),
    )
    expect(schedule[10]!.plannedDate).toBe('2026-06-10') // #11
    expect(schedule[11]!.plannedDate).toBe('2026-07-10') // #12
    expect(schedule[12]!.plannedDate).toBe('2026-08-10') // #13
    expect(schedule[13]!.plannedDate).toBe('2026-09-10') // #14
    // `91:56` "12 / 360 pagas" and `91:132` "... 346 parcelas restantes":
    // #11 and #12 are "Paga" (`91:105`, `91:113`), #13 and #14 "Prevista"
    // (`91:121`, `91:129`).
    expect(schedule.map((i) => i.status).slice(10, 14)).toEqual([
      'Paid',
      'Paid',
      'Planned',
      'Planned',
    ])
  })

  it('rejects an installment count that is zero, negative or fractional', () => {
    expect(() => buildInstallmentSchedule(liability({ installmentCount: 0 }))).toThrow(
      'installment_schedule.invalid_installment_count',
    )
    expect(() => buildInstallmentSchedule(liability({ installmentCount: -1 }))).toThrow(
      'installment_schedule.invalid_installment_count',
    )
    expect(() => buildInstallmentSchedule(liability({ installmentCount: 1.5 }))).toThrow(
      'installment_schedule.invalid_installment_count',
    )
  })

  it('rejects "parcelas já pagas" outside [0, installmentCount]', () => {
    expect(() =>
      buildInstallmentSchedule(liability({ installmentCount: 3, installmentsAlreadyPaid: 4 })),
    ).toThrow('installment_schedule.invalid_installments_already_paid')
    expect(() => buildInstallmentSchedule(liability({ installmentsAlreadyPaid: -1 }))).toThrow(
      'installment_schedule.invalid_installments_already_paid',
    )
  })

  it('rejects a negative monthly rate', () => {
    expect(() => buildInstallmentSchedule(liability({ monthlyInterestRate: -0.01 }))).toThrow(
      'installment_schedule.invalid_rate',
    )
  })

  it('rejects a negative original amount', () => {
    expect(() => buildInstallmentSchedule(liability({ originalAmount: cents(-1) }))).toThrow(
      'installment_schedule.invalid_original_amount',
    )
  })
})

describe('applyRateAdjustment — "recalcula apenas as parcelas ainda Previstas" (files_design/03)', () => {
  function schedule(): Installment[] {
    return buildInstallmentSchedule(
      liability({ installmentCount: 4, installmentsAlreadyPaid: 1, monthlyInterestRate: 0.01 }),
    )
  }

  it('never rewrites an installment already Paga, even when its date is after effectiveFrom', () => {
    const original = schedule()
    const result = applyRateAdjustment(
      liability({ installmentCount: 4, installmentsAlreadyPaid: 1 }),
      original,
      { liabilityId: asId<LiabilityId>('l1'), newRate: 0.02, effectiveFrom: isoDate('2026-01-10') },
    )
    // Installment #1 was Paga at the OLD amount; the new rate must not touch it.
    expect(result.installments[0]).toEqual(original[0])
  })

  it('recomputes every Prevista installment on/after effectiveFrom, preserving the total shape', () => {
    const original = schedule()
    const result = applyRateAdjustment(
      liability({ installmentCount: 4, installmentsAlreadyPaid: 1 }),
      original,
      { liabilityId: asId<LiabilityId>('l1'), newRate: 0.02, effectiveFrom: isoDate('2026-02-10') },
    )
    const affected = result.installments.slice(1)
    expect(affected.every((i) => i.status === 'Planned')).toBe(true)
    // A higher rate on the same remaining balance must raise, not lower, the
    // instalment: this is the assertion that would catch a sign error in the
    // present-value/re-amortisation math.
    expect(affected[0]!.plannedAmount).toBeGreaterThan(original[1]!.plannedAmount)
  })

  it('updates the liability to carry the new rate', () => {
    const result = applyRateAdjustment(liability(), schedule(), {
      liabilityId: asId<LiabilityId>('l1'),
      newRate: 0.02,
      effectiveFrom: isoDate('2026-02-10'),
    })
    expect(result.liability.monthlyInterestRate).toBe(0.02)
  })

  it('produces a RateAdjustment trace event worded with both rates', () => {
    const result = applyRateAdjustment(liability(), schedule(), {
      liabilityId: asId<LiabilityId>('l1'),
      newRate: 0.02,
      effectiveFrom: isoDate('2026-02-10'),
    })
    expect(result.event).toEqual({
      date: '2026-02-10',
      kind: 'RateAdjustment',
      origin: { kind: 'Liability', liabilityId: 'l1' },
      description: 'Taxa de juros reajustada de 1,00% para 2,00% a.m.',
    })
  })

  it('leaves the schedule untouched when no instalment is still open on/after effectiveFrom', () => {
    const fullyPaid = buildInstallmentSchedule(
      liability({ installmentCount: 2, installmentsAlreadyPaid: 2 }),
    )
    const result = applyRateAdjustment(
      liability({ installmentCount: 2, installmentsAlreadyPaid: 2 }),
      fullyPaid,
      {
        liabilityId: asId<LiabilityId>('l1'),
        newRate: 0.05,
        effectiveFrom: isoDate('2026-01-10'),
      },
    )
    expect(result.installments).toBe(fullyPaid)
  })

  it('rejects an adjustment addressed to a different liability', () => {
    expect(() =>
      applyRateAdjustment(liability(), schedule(), {
        liabilityId: asId<LiabilityId>('another'),
        newRate: 0.02,
        effectiveFrom: isoDate('2026-02-10'),
      }),
    ).toThrow('rate_adjustment.liability_mismatch')
  })

  it('rejects a negative new rate', () => {
    expect(() =>
      applyRateAdjustment(liability(), schedule(), {
        liabilityId: asId<LiabilityId>('l1'),
        newRate: -0.01,
        effectiveFrom: isoDate('2026-02-10'),
      }),
    ).toThrow('rate_adjustment.invalid_rate')
  })
})

describe('outstandingBalance — "Saldo devedor atual" (Figma `91:2` nó `91:50`)', () => {
  /**
   * A MEDIÇÃO que fecha P5 (CLAUDE.md §7.1). O frame `91:2` (página Wireframe,
   * "Desktop — Detalhe do Passivo (análise de dívida)") desenha, no MESMO card
   * `338:2` e na MESMA linha `91:44`: "Valor original R$ 320.000,00" (`91:47`),
   * "Saldo devedor atual R$ 178.400,00" (`91:50`), "0,85% a.m." (`91:53`) e
   * "12 / 360 pagas" (`91:56`); a parcela é R$ 1.520,00 (`91:104`) e a taxa de
   * cadastro, 0,80% a.m. (`91:145`).
   *
   *  - soma NOMINAL das 348 restantes = 348 × R$ 1.520,00 = R$ 528.960,00,
   *    1,65× o valor original impresso ao lado dela;
   *  - VALOR PRESENTE das mesmas 348 a 0,80% a.m. = R$ 178.128,97, 0,15% abaixo
   *    dos R$ 178.400,00 desenhados.
   *
   * Logo "Saldo devedor atual" é o PRINCIPAL em aberto, não a soma nominal.
   */
  it('Figma 91:2 nó 91:47/91:50 — o saldo devedor nunca passa do "Valor original"', () => {
    const frame = liability({
      originalAmount: cents(32_000_000),
      installmentCount: 360,
      installmentsAlreadyPaid: 12,
      monthlyInterestRate: 0.0085,
    })
    const schedule = buildInstallmentSchedule(frame)
    const nominal = schedule
      .filter((installment) => installment.status === 'Planned')
      .reduce((total, installment) => total + installment.plannedAmount, 0)

    const balance = outstandingBalance(schedule, frame.monthlyInterestRate)

    // A soma nominal é 3,1× o valor original: o card desenharia um saldo devedor
    // maior que a dívida contraída, que é o que o frame nunca mostra.
    expect(nominal).toBeGreaterThan(frame.originalAmount)
    expect(balance).toBeLessThanOrEqual(frame.originalAmount)
  })

  it('Figma 91:2 nó 91:62 — com 0 parcelas pagas o saldo devedor É o valor original', () => {
    const frame = liability({
      originalAmount: cents(32_000_000),
      installmentCount: 360,
      installmentsAlreadyPaid: 0,
      monthlyInterestRate: 0.0085,
    })

    const balance = outstandingBalance(buildInstallmentSchedule(frame), frame.monthlyInterestRate)

    // Não é igualdade exata: `splitEvenly` arredonda a parcela de 2.855,6369
    // para 2.855,64, e 0,31 centavo a mais em 348 parcelas descontadas vale
    // 25 centavos de saldo. A âncora do gráfico (barra Ago/25 = R$ 320.000,00)
    // é o valor original a menos desse arredondamento.
    expect(Math.abs(balance - frame.originalAmount)).toBeLessThanOrEqual(100)
  })

  it('Figma 91:2 nó 91:50/91:104/91:145 — 348 parcelas de R$ 1.520,00 a 0,80% a.m. fecham nos R$ 178.400,00 desenhados', () => {
    const remaining: Installment[] = Array.from({ length: 348 }, (_, index) => ({
      id: asId<InstallmentId>(`l1#${index + 13}`),
      liabilityId: asId<LiabilityId>('l1'),
      number: index + 13,
      plannedDate: isoDate('2026-08-15'),
      plannedAmount: cents(152_000),
      status: 'Planned',
      paidAmount: null,
      paidDate: null,
      discarded: false,
    }))

    const balance = outstandingBalance(remaining, 0.008)

    expect(balance).toBe(17_812_897)
    // 0,15% do "R$ 178.400,00" do nó `91:50`; a soma nominal erraria por 197%.
    expect(Math.abs(balance - 17_840_000) / 17_840_000).toBeLessThan(0.002)
  })

  it('ignores what is already Paga', () => {
    const schedule = buildInstallmentSchedule(
      liability({ installmentCount: 4, installmentsAlreadyPaid: 2 }),
    )
    const openOnly = outstandingBalance(schedule, 0.01)
    expect(openOnly).toBe(outstandingBalance(schedule.slice(2), 0.01))
  })

  it('is zero once every instalment is Paga', () => {
    const schedule = buildInstallmentSchedule(
      liability({ installmentCount: 2, installmentsAlreadyPaid: 2 }),
    )
    expect(outstandingBalance(schedule, 0.01)).toBe(0)
  })

  it('is zero for an empty schedule', () => {
    expect(outstandingBalance([], 0.01)).toBe(0)
  })

  it('at 0% a.m. the principal in arrears IS the nominal sum — there is no interest to discount', () => {
    const schedule = buildInstallmentSchedule(
      liability({ originalAmount: cents(100_000), installmentCount: 4, monthlyInterestRate: 0 }),
    )
    expect(outstandingBalance(schedule, 0)).toBe(100_000)
  })
})

describe('outstandingBalanceOverTime — "gráfico do saldo devedor caindo" (Figma `91:2` nó `91:59`)', () => {
  it('ends at zero and, before the first instalment, equals the original amount', () => {
    const debt = liability({ installmentCount: 3, installmentsAlreadyPaid: 0 })
    const schedule = buildInstallmentSchedule(debt)

    const points = outstandingBalanceOverTime(schedule, debt.monthlyInterestRate)

    expect(points).toHaveLength(3)
    expect(points[2]!.balance).toBe(0)
    // Cada ponto é o principal em aberto depois de liquidada AQUELA parcela, e
    // não a soma nominal do que resta: somar a parcela #1 ao ponto 0 e trazer o
    // conjunto um mês para trás devolve o valor original (Figma `91:62`, a
    // barra Ago/25, a mais alta da série).
    expect(
      Math.round(
        (points[0]!.balance + schedule[0]!.plannedAmount) / (1 + debt.monthlyInterestRate),
      ),
    ).toBe(debt.originalAmount)
    expect(points[0]!.balance).toBeLessThan(schedule[1]!.plannedAmount + schedule[2]!.plannedAmount)
    expect(points.map((p) => p.date)).toEqual(schedule.map((i) => i.plannedDate))
  })

  it('Figma 91:2 nó 91:59 — a série inteira cabe abaixo do valor original e é decrescente', () => {
    const frame = liability({
      originalAmount: cents(32_000_000),
      installmentCount: 360,
      monthlyInterestRate: 0.0085,
    })

    const points = outstandingBalanceOverTime(
      buildInstallmentSchedule(frame),
      frame.monthlyInterestRate,
    )

    expect(points[0]!.balance).toBeLessThanOrEqual(frame.originalAmount)
    points.forEach((point, index) => {
      if (index > 0) expect(point.balance).toBeLessThan(points[index - 1]!.balance)
    })
  })
})

describe('formatMonthlyRate', () => {
  it('formats a fraction as a pt-BR percentage with 2 decimals', () => {
    expect(formatMonthlyRate(0.0085)).toBe('0,85%')
    expect(formatMonthlyRate(0)).toBe('0,00%')
  })
})

describe('markInstallmentPaid — "Marcar Paga" (files_design/01 §12)', () => {
  const planned = buildInstallmentSchedule(liability({ installmentCount: 1 }))[0]!

  it('produces a single event worded "valor conforme previsto" when the amount matches', () => {
    const result = markInstallmentPaid(planned, planned.plannedAmount, isoDate('2026-02-10'))
    expect(result.installment.status).toBe('Paid')
    expect(result.installment.paidAmount).toBe(planned.plannedAmount)
    expect(result.event).toEqual({
      date: '2026-02-10',
      kind: 'InstallmentPaid',
      origin: { kind: 'Liability', liabilityId: planned.liabilityId },
      description: `Parcela #${planned.number} paga: valor conforme previsto`,
    })
  })

  /**
   * P6 (produto, 2026-09-08) — a parcela paga passou a contar no DRE, e o mês
   * contábil dela é o da data de pagamento, não o da prevista (PRD §5, regime
   * de caixa; CLAUDE.md §3). O formulário já pedia a data e o endpoint já a
   * recebia; ela ia só para o Evento e era descartada da parcela, o que fazia
   * uma parcela prevista para agosto e paga em setembro cair no DRE de agosto.
   */
  it('P6 — guarda a data de pagamento na parcela, não só no Evento', () => {
    const paga = markInstallmentPaid(planned, planned.plannedAmount, isoDate('2026-03-02'))

    expect(paga.installment.paidDate).toBe('2026-03-02')
    expect(paga.installment.plannedDate).not.toBe(paga.installment.paidDate)
  })

  it('words the event with both amounts when the paid amount diverges', () => {
    const paidMore = cents(planned.plannedAmount + 2000)
    const result = markInstallmentPaid(planned, paidMore, isoDate('2026-02-10'))
    expect(result.event.description).toBe(
      `Parcela #${planned.number} paga: previsto ${new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(planned.plannedAmount / 100)}, pago ${new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(paidMore / 100)}`,
    )
  })

  it('never offers the three-way overpayment choice or a Pendência: it is not in the result shape', () => {
    const result = markInstallmentPaid(
      planned,
      cents(planned.plannedAmount + 1),
      isoDate('2026-02-10'),
    )
    expect(result).not.toHaveProperty('outcome')
    expect(result).not.toHaveProperty('becomesPending')
  })

  it('rejects marking an already-Paga instalment paid again', () => {
    const paid = { ...planned, status: 'Paid' as const, paidAmount: planned.plannedAmount }
    expect(() => markInstallmentPaid(paid, planned.plannedAmount, isoDate('2026-02-10'))).toThrow(
      'installment_payment.already_paid',
    )
  })

  it('rejects a negative paid amount', () => {
    expect(() => markInstallmentPaid(planned, cents(-1), isoDate('2026-02-10'))).toThrow(
      'installment_payment.negative_amount',
    )
  })
})

describe('liabilityRegisteredEvent — "Cadastro" (Event Storming Fluxo K, Figma 150:20)', () => {
  it('P35 — grava a forma do Detalhe (91:145): sem o nome, que a Home acrescenta', () => {
    const event = liabilityRegisteredEvent(
      liability({
        name: 'Financiamento apartamento',
        originalAmount: cents(32_000_000),
        installmentCount: 360,
        monthlyInterestRate: 0.008,
      }),
      isoDate('2026-01-10'),
    )
    expect({ ...event, description: plainSpaces(event.description) }).toEqual({
      date: '2026-01-10',
      kind: 'Registration',
      origin: { kind: 'Liability', liabilityId: 'l1' },
      description: 'Dívida cadastrada: R$ 320.000,00, 360 parcelas, taxa inicial 0,80% a.m.',
    })
  })
})

/**
 * "Descartar" numa Parcela — Figma `10:2` nó 144:17 (o terceiro botão da linha
 * de Passivo) e frame `34:2` nó 34:31 (o diálogo). O EFEITO está escrito no nó
 * 34:36: "A série continua normalmente a partir do mês seguinte."
 */
describe('discardInstallment — "Descartar" (Figma 10:2 nó 144:17, 34:2 nó 34:36)', () => {
  it('Figma 34:2 nó 34:36 — a série continua: nem o número nem a data de nenhuma parcela muda', () => {
    const schedule = buildInstallmentSchedule(
      liability({ installmentCount: 3, startDate: isoDate('2026-01-10') }),
    )
    const [first, second, third] = schedule

    const discarded = discardInstallment(first!)

    expect(discarded.discarded).toBe(true)
    expect(discarded.number).toBe(first!.number)
    expect(discarded.plannedDate).toBe(first!.plannedDate)
    // A função devolve UMA parcela: as seguintes chegam intactas do cronograma,
    // que não é regenerado nem deslocado.
    expect([second!.number, second!.plannedDate]).toEqual([2, '2026-02-10'])
    expect([third!.number, third!.plannedDate]).toEqual([3, '2026-03-10'])
  })

  it('Figma 34:2 nó 34:36 — descartar não muda o saldo devedor: a parcela segue Prevista', () => {
    const schedule = buildInstallmentSchedule(liability({ installmentCount: 3 }))
    const before = outstandingBalance(schedule, 0.01)

    const after = outstandingBalance(
      schedule.map((installment, index) =>
        index === 0 ? discardInstallment(installment) : installment,
      ),
      0.01,
    )

    expect(after).toBe(before)
  })

  it('files_design/01 §6 — recusa descartar uma parcela já Paga (a ação é da lista do Previsto)', () => {
    const [paid] = buildInstallmentSchedule(
      liability({ installmentCount: 2, installmentsAlreadyPaid: 1 }),
    )
    expect(() => discardInstallment(paid!)).toThrow('installment.cannot_discard_paid_installment')
  })
})
