/**
 * Passivo — amortisation schedule, rate adjustment and outstanding balance
 * (files_design/01 §12 "Detalhe do Passivo", files_design/03 "Passivos").
 *
 * Event Storming H9 is closed: a liability is **100% manual** and lives on a
 * plane of its own. Nothing here reads a Lançamento, and paying an expense never
 * writes off a debt — that is exactly the double counting PRD v6 (E) forbids.
 */

import {
  asId,
  cents,
  formatMoney,
  isNegative,
  multiply,
  sameDayInAnotherMonth,
  splitEvenly,
} from '@/domain/core'
import type { Cents, InstallmentId, IsoDate } from '@/domain/core'
import { describeRegistration, type NewTraceEvent } from '@/domain/trace-events'
import type { Installment, Liability, RateAdjustment } from './types'

/**
 * Price system (Tabela Price): the constant instalment that amortises `principal`
 * in `count` months at the monthly rate `rate`.
 *
 *     PMT = PV · i / (1 − (1 + i)^−n)
 *
 * Price é a fórmula CONFIRMADA por produto em 2026-09-08 (P3) — nada mudou no
 * código, mudou o fato de a escolha estar decidida em vez de assumida. A nota
 * `164:2` do Wireframe fixa o FLUXO —
 * `164:4`: "escolhemos a (A) [o sistema calcula a amortização] por pedido
 * explícito de produto" — and deliberately leaves the arithmetic open: "a
 * fórmula exata precisa ser validada por alguém de backend/financeiro antes de
 * implementar: um erro aqui mostra saldo devedor errado pra pessoa".
 * files_design/00 hands the same "exatidão da fórmula" to engineering, so the
 * choice is recorded here instead of being implied by the code. Price — not SAC — because
 * the Passivos form collects a single "Valor da parcela" (files_design/03) and
 * Revisão de Recorrentes lists one instalment per month "calculado por
 * amortização, não digitado pela pessoa" (files_design/01 §6): one number for the
 * whole schedule is a constant instalment by definition. SAC would produce a
 * different amount every month and no field on any screen could hold it.
 *
 * At i = 0 the closed form divides by zero; the limit is the principal split in
 * `count` equal parts, which is what a debt with no interest is.
 */
function priceInstallmentFactor(rate: number, count: number): number {
  if (rate === 0) return 1 / count
  return rate / (1 - Math.pow(1 + rate, -count))
}

/** Chronological order. `number` is the schedule's own 1..n sequence (files_design/03). */
function byNumber(installments: readonly Installment[]): Installment[] {
  return [...installments].sort((a, b) => a.number - b.number)
}

/**
 * Present value of a stream of instalments, in cents, discounted at the debt's
 * monthly rate: the PRINCIPAL that stream still pays off today.
 *
 *     B = Σ_{k=1..m} parcela_k / (1 + i)^k
 *
 * A float that never leaves the domain — the caller rounds once, at the end.
 * The inverse of `priceInstallmentFactor`: a schedule Price generated from
 * `originalAmount` discounts back to exactly `originalAmount`, which is the
 * invariant every screen showing "Saldo devedor" depends on.
 */
function presentValueOfStream(amounts: readonly Cents[], monthlyRate: number): number {
  let presentValue = 0
  for (let k = 0; k < amounts.length; k += 1) {
    presentValue += amounts[k]! / Math.pow(1 + monthlyRate, k + 1)
  }
  return presentValue
}

/**
 * The whole schedule of a Passivo, generated from the ten form fields
 * (files_design/03 "Detalhe do Passivo — objeto Parcela").
 *
 * The total is rounded once, from the exact Price instalment, and only then split
 * by `splitEvenly`. Rounding each instalment on its own and summing afterwards
 * drifts by up to n/2 cents against the total the person sees — `splitEvenly`
 * keeps the invariant that the parts add back up to the whole (ADR-0001 §5).
 *
 * `installmentsAlreadyPaid` pre-populates the history of a debt already under way
 * (files_design/03): the first k instalments are born Paga.
 */
/**
 * The four shape rules a Passivo's form has to satisfy before a schedule can be
 * derived from it (files_design/03 "Passivos (formulário completo)").
 *
 * Named apart from `buildInstallmentSchedule` so the failure has a code the
 * boundary maps to 422 instead of a raw CHECK-constraint 500 from `schema.ts`
 * (src/api/http.ts). Cadastro is the only caller: `PATCH /liabilities/{id}` no
 * longer accepts any of these fields, because the only schedule recomputation
 * the design draws is the rate adjustment (Wireframe `91:2` node `91:98` /
 * Mockup `948:1687` node `949:72`).
 */
function assertScheduleShape(liability: Liability): void {
  const { installmentCount, installmentsAlreadyPaid, monthlyInterestRate } = liability

  if (!Number.isInteger(installmentCount) || installmentCount <= 0) {
    throw new Error('installment_schedule.invalid_installment_count')
  }
  if (
    !Number.isInteger(installmentsAlreadyPaid) ||
    installmentsAlreadyPaid < 0 ||
    installmentsAlreadyPaid > installmentCount
  ) {
    throw new Error('installment_schedule.invalid_installments_already_paid')
  }
  if (!Number.isFinite(monthlyInterestRate) || monthlyInterestRate < 0) {
    throw new Error('installment_schedule.invalid_rate')
  }
  if (isNegative(liability.originalAmount)) {
    throw new Error('installment_schedule.invalid_original_amount')
  }
}

export function buildInstallmentSchedule(liability: Liability): Installment[] {
  const { installmentCount, installmentsAlreadyPaid, monthlyInterestRate } = liability
  assertScheduleShape(liability)

  // O cronograma sai de Valor original + Taxa + Número de parcelas, e o "Valor
  // da parcela" DECLARADO não entra na conta. Isso está decidido, não em aberto:
  // a nota de design `164:2` (Wireframe, "Nota — Passivo: cálculo automático de
  // juros foi escolha deliberada") diz, no texto `164:4`, que entre "(A) sistema
  // calcula a amortização e recalcula a cada reajuste de juros" e "(B) só
  // registra valores reais confirmados", "escolhemos a (A) por pedido explícito
  // de produto". O que a MESMA nota deixa aberto é outra coisa — "a fórmula
  // exata precisa ser validada por alguém de backend/financeiro" (P3 em
  // docs/PERGUNTAS-EM-ABERTO.md; a escolha de Price está em
  // `priceInstallmentFactor`).
  //
  // Nenhuma tela exibe o valor declarado de volta, então não existe divergência
  // a mostrar para a pessoa: o card "Informações da Dívida" do `91:2` tem
  // exatamente quatro itens — Valor original (`91:47`), Saldo devedor atual
  // (`91:50`), Taxa de juros atual (`91:53`) e Parcelas (`91:56`) — e a linha da
  // lista de Passivos tem dois, Saldo devedor e Parcelas (Wireframe `40:2` nós
  // `90:66`/`90:67` e `90:69`/`90:70`; Mockup `933:1416` nós `934:71`/`934:72` e
  // `934:74`/`934:75`). A única divergência que o design desenha é
  // previsto-vs-pago, e ela vira Evento de rastreabilidade em
  // `markInstallmentPaid`, abaixo.
  //
  // `installmentAmount` continua no modelo porque é campo obrigatório do
  // formulário ("Valor da parcela *", `40:2` nó `90:30`): é dado cadastral
  // declarado, não entrada de cálculo — não apague, e não ligue no cálculo.
  //
  // Os números do `91:2` não são especificação numérica desta fórmula, e a
  // medição prova: 348 × R$ 1.520,00 = R$ 528.960,00 contra "Saldo devedor
  // atual R$ 178.400,00" desenhado ao lado, e Price sobre R$ 320.000,00 em 360
  // meses dá R$ 2.855,64 a 0,85% (R$ 2.714,11 a 0,80%), não R$ 1.520,00.
  const factor = priceInstallmentFactor(monthlyInterestRate, installmentCount)
  const plannedTotal = multiply(liability.originalAmount, factor * installmentCount)

  return splitEvenly(plannedTotal, installmentCount).map((plannedAmount, index) => {
    const number = index + 1
    const paid = index < installmentsAlreadyPaid
    return {
      // A schedule row has a natural key — the debt plus its number — so the
      // domain can mint it without a clock or a random source (src/domain/README).
      id: asId<InstallmentId>(`${liability.id}#${number}`),
      liabilityId: liability.id,
      number,
      // `index`, not `index + 1`: parcela #1 falls on the start date ITSELF.
      // files_design/03 says only "Data de início + periodicidade mensal", but
      // the Figma frame `91:2` (página Wireframe, "Desktop — Detalhe do Passivo")
      // measures it. Card "Parcelas" (`91:56`) reads "12 / 360 pagas"; the four
      // rows below print #11 = 10/06/2026 (`91:103`), #12 = 10/07/2026
      // (`91:111`), #13 = 10/08/2026 (`91:119`), #14 = 10/09/2026 (`91:127`).
      // Counting #12 back one month at a time lands #1 on 10/08/2025 — the start
      // month. Two independent nodes agree: the chart `91:61` draws exactly 12
      // bars for those 12 paid instalments and labels the first `91:64` "Ago/25",
      // and the debt was registered on 15/08/2025 (`91:145`). With `index + 1`
      // the schedule slides a month: #11 would print 10/07/2026 and the first bar
      // would be "Set/25", leaving the start month off the chart entirely.
      plannedDate: sameDayInAnotherMonth(liability.startDate, index),
      // A parcela "já paga" na abertura do cadastro não tem data de pagamento
      // informada por ninguém: nenhum campo do formulário a pede. Fica nula, e o
      // DRE a trata pela data PREVISTA — decisão de produto de 2026-09-08 (P27),
      // tomada depois de a P6 trazer a parcela para dentro da cascata e com a
      // consequência medida: cadastrar uma dívida em andamento escreve despesa
      // nos meses passados correspondentes.
      paidDate: null,
      plannedAmount,
      status: paid ? 'Paid' : 'Planned',
      // P27 (produto, 2026-09-08): o formulário não pergunta quanto foi pago de
      // fato numa dívida já em andamento, e essas parcelas CONTAM no DRE do mês
      // previsto delas. Usa-se o valor previsto, o mesmo default que "Marcar
      // Pago" oferece ("valor previsto da ocorrência", files_design/03).
      //
      // É um valor presumido alimentando um relatório, e isso foi decidido
      // sabendo disso: a alternativa — pedir o valor real de cada parcela antiga
      // no cadastro — cobra da pessoa um dado que ela provavelmente não tem à
      // mão para desbloquear o cadastro de uma dívida. Sinalizar na tela que
      // esses valores são presumidos continua em aberto do lado do design:
      // nenhum frame do Detalhe do Passivo distingue parcela presumida de
      // parcela confirmada.
      paidAmount: paid ? plannedAmount : null,
      discarded: false,
    }
  })
}

/**
 * "Descartar" numa Parcela, na Revisão de Recorrentes — Figma `10:2` nó 144:17
 * (o terceiro botão da linha de Passivo, 86×31, ao lado de 144:13 "Marcar
 * Pago" e 144:15 "Editar juros"), diálogo no frame `34:2` nó 34:31.
 *
 * O QUE ISSO FAZ está escrito no próprio frame, nó 34:36: "A série continua
 * normalmente a partir do mês seguinte." Logo, e sem inventar nada além disso:
 *  - o cronograma NÃO se desloca — nem `number` nem `plannedDate` de nenhuma
 *    parcela muda, aqui ou nas seguintes (a função devolve UMA parcela, como
 *    `discardOccurrence` devolve UMA ocorrência e nunca a série);
 *  - o saldo devedor não muda: `outstandingBalance` desconta toda parcela ainda
 *    `Planned`, e uma parcela descartada continua Prevista — descartar tira a
 *    linha da revisão DESTE mês, não perdoa a dívida.
 *
 * Uma parcela já Paga não pode ser descartada, pelo mesmo motivo que uma
 * ocorrência Paga não pode (src/domain/recurrence/engine.ts
 * `discardOccurrence`): "Descartar" é ação da lista do que ainda está Previsto
 * (files_design/01 §6).
 */
export function discardInstallment(installment: Installment): Installment {
  if (installment.status === 'Paid') {
    throw new Error('installment.cannot_discard_paid_installment')
  }
  return { ...installment, discarded: true }
}

export interface RateAdjustmentResult {
  /** The Passivo carrying the new rate — "Taxa de juros atual" (files_design/01 §12). */
  readonly liability: Liability
  readonly installments: readonly Installment[]
  readonly event: NewTraceEvent
}

/** "0,85%" — the unit every Passivo screen prints the rate in (files_design/03). */
export function formatMonthlyRate(rate: number): string {
  const percent = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rate * 100)
  return `${percent}%`
}

/**
 * "Registrar Reajuste de Juros" (files_design/03).
 *
 * Recomputes the planned amount of every instalment still **Prevista** from
 * `effectiveFrom` onwards. **Parcelas já pagas nunca são alteradas
 * retroativamente** — the rule is explicit in files_design/03, and so is the
 * trace event this produces.
 *
 * How the new amount is found, since the sources define the flow and not the
 * formula (files_design/00):
 *  1. a rate change does not change what is owed today, only what the rest costs.
 *     The balance on the effective date is therefore the present value of the
 *     instalments still Prevista, discounted at the rate that generated them;
 *  2. that balance is re-amortised by Price at the new rate over the instalments
 *     that remain;
 *  3. everything before the effective date — paid or not — is left alone.
 *
 * `registeredOn` is the date of the event in the log. The domain has no clock
 * (src/domain/README), so the caller passes it; without it the effective date is
 * the only date the sources offer.
 */
export function applyRateAdjustment(
  liability: Liability,
  installments: readonly Installment[],
  adjustment: RateAdjustment,
  registeredOn: IsoDate = adjustment.effectiveFrom,
): RateAdjustmentResult {
  if (adjustment.liabilityId !== liability.id) {
    throw new Error('rate_adjustment.liability_mismatch')
  }
  if (!Number.isFinite(adjustment.newRate) || adjustment.newRate < 0) {
    throw new Error('rate_adjustment.invalid_rate')
  }

  const affected = byNumber(installments).filter(
    (installment) =>
      installment.status === 'Planned' && installment.plannedDate >= adjustment.effectiveFrom,
  )

  const event: NewTraceEvent = {
    date: registeredOn,
    kind: 'RateAdjustment',
    origin: { kind: 'Liability', liabilityId: liability.id },
    // Wording taken verbatim from the example in files_design/03.
    description: `Taxa de juros reajustada de ${formatMonthlyRate(
      liability.monthlyInterestRate,
    )} para ${formatMonthlyRate(adjustment.newRate)} a.m.`,
  }
  const adjusted: Liability = { ...liability, monthlyInterestRate: adjustment.newRate }

  if (affected.length === 0) {
    return { liability: adjusted, installments, event }
  }

  // The balance on the effective date — the same present value "Saldo devedor
  // atual" shows, at the OLD rate, since the rate that generated the stream is
  // the rate that discounts it back.
  const presentValue = presentValueOfStream(
    affected.map((installment) => installment.plannedAmount),
    liability.monthlyInterestRate,
  )

  const newTotal = cents(
    Math.round(
      presentValue * priceInstallmentFactor(adjustment.newRate, affected.length) * affected.length,
    ),
  )
  const shares = splitEvenly(newTotal, affected.length)
  const newAmountById = new Map<InstallmentId, Cents | undefined>(
    affected.map((installment, index) => [installment.id, shares[index]]),
  )

  return {
    liability: adjusted,
    installments: installments.map((installment) => {
      const share = newAmountById.get(installment.id)
      return share === undefined ? installment : { ...installment, plannedAmount: share }
    }),
    event,
  }
}

/**
 * "Saldo devedor atual" (files_design/01 §12) — o PRINCIPAL ainda em aberto: o
 * valor presente das parcelas ainda Previstas, descontadas à taxa do passivo.
 * A mesma grandeza alimenta a linha "saldo devedor de financiamento" do Balanço
 * (PRD §5), a coluna "Saldo devedor" da lista de Passivos (Figma `40:2` nó
 * `90:67`) e o gráfico `91:59`.
 *
 * P5 fechou pela medição, não por dedução (CLAUDE.md §7.1). O frame `91:2`
 * (página Wireframe, "Desktop — Detalhe do Passivo (análise de dívida)")
 * desenha, no MESMO card `338:2` e na MESMA linha `91:44`: "Valor original
 * R$ 320.000,00" (`91:47`) ao lado de "Saldo devedor atual R$ 178.400,00"
 * (`91:50`), com "12 / 360 pagas" (`91:56`) e parcela de R$ 1.520,00 (`91:104`).
 *  - soma NOMINAL das 348 restantes = R$ 528.960,00, ou seja MAIOR que o valor
 *    original impresso a 259,5px dela — o card não tem como desenhar isso;
 *  - VALOR PRESENTE das mesmas 348 à taxa de cadastro 0,80% a.m. (`91:145`) =
 *    R$ 178.128,97, a 0,15% do número desenhado.
 * O gráfico `91:59` confirma a mesma âncora: a primeira barra (`91:63`, Ago/25)
 * tem 120px e a última (Jul/26) 67,2px — razão 0,560, contra 178.400/320.000 =
 * 0,5575. A série sai do valor original e cai; na soma nominal ela sairia de
 * R$ 1.028.029,31 (a parcela é re-derivada por Price) e cairia 3,3%.
 */
export function outstandingBalance(
  installments: readonly Installment[],
  monthlyInterestRate: number,
): Cents {
  return cents(
    Math.round(
      presentValueOfStream(
        byNumber(installments)
          .filter((installment) => installment.status === 'Planned')
          .map((installment) => installment.plannedAmount),
        monthlyInterestRate,
      ),
    ),
  )
}

/** One point of the "Evolução da Dívida" chart (files_design/01 §12). */
export interface OutstandingBalancePoint {
  readonly date: IsoDate
  /** What is still owed once the instalment due on that date is settled. */
  readonly balance: Cents
}

/**
 * The debt falling over time, one point per instalment, ending at zero
 * (files_design/01 §12 "gráfico do saldo devedor caindo ao longo do tempo").
 *
 * The series is built from the planned amounts alone, so it stays the curve the
 * schedule describes; a payment that diverged from the plan is a Evento of its
 * own (files_design/03) and does not bend this line. The point right after the
 * last Paga therefore equals `outstandingBalance`.
 */
export function outstandingBalanceOverTime(
  installments: readonly Installment[],
  monthlyInterestRate: number,
): OutstandingBalancePoint[] {
  const points: OutstandingBalancePoint[] = []
  // Same principal `outstandingBalance` returns, walked backwards: the balance
  // one month earlier is the balance after the next instalment PLUS that
  // instalment, brought back one period. Float until the point is emitted, so
  // 360 roundings do not accumulate into the series the person reads.
  let balance = 0
  for (const installment of byNumber(installments).reverse()) {
    points.unshift({ date: installment.plannedDate, balance: cents(Math.round(balance)) })
    balance = (balance + installment.plannedAmount) / (1 + monthlyInterestRate)
  }
  return points
}

/**
 * "Cadastro" — the trace event a new Passivo produces (Event Storming Fluxo K;
 * wording from `RegistrationEventData`'s example, Figma 150:20: "Financiamento
 * apartamento cadastrado: R$ 320.000,00, 360 parcelas, taxa inicial 0,80% a.m.").
 *
 * `registeredOn` is supplied by the caller, never read from a clock
 * (src/domain/README.md).
 */
export function liabilityRegisteredEvent(
  liability: Liability,
  registeredOn: IsoDate,
): NewTraceEvent {
  return {
    date: registeredOn,
    kind: 'Registration',
    origin: { kind: 'Liability', liabilityId: liability.id },
    // P35: a frase era montada aqui, duplicando `describeRegistration` — e por
    // isso mudar a regra não mudava nada em produção. Agora há uma só.
    description: describeRegistration({
      originalAmount: liability.originalAmount,
      installmentCount: liability.installmentCount,
      initialRate: liability.monthlyInterestRate,
    }),
  }
}

export interface InstallmentPaymentResult {
  readonly installment: Installment
  readonly event: NewTraceEvent
}

/**
 * "Marcar Paga" (files_design/01 §12, files_design/03 "Detalhe do Passivo —
 * objeto Parcela"): pede o valor real pago, e gera **um** Evento de
 * rastreabilidade sempre — worded one of two ways depending on whether the
 * amounts match (files_design/03 gives both example sentences verbatim:
 * "Parcela #11 paga: valor conforme previsto" / "Parcela #12 paga: previsto
 * R$ 1.520,00, pago R$ 1.540,00").
 *
 * Unlike a Lançamento's `markAsPaid` (`entries/rules.ts`), a divergent
 * instalment never becomes a Pendência and never offers the three-way
 * overpayment choice: no source (files_design/01 §12, §03 "objeto Parcela")
 * extends UC26's three-choice/Pendência machinery from Fluxo B/D (recorrência)
 * to Fluxo K (passivo) — inventing that extension here would be a rule with no
 * source behind it.
 */
export function markInstallmentPaid(
  installment: Installment,
  paidAmount: Cents,
  paymentDate: IsoDate,
): InstallmentPaymentResult {
  if (installment.status === 'Paid') {
    throw new Error('installment_payment.already_paid')
  }
  if (isNegative(paidAmount)) {
    throw new Error('installment_payment.negative_amount')
  }

  const description =
    paidAmount === installment.plannedAmount
      ? `Parcela #${installment.number} paga: valor conforme previsto`
      : `Parcela #${installment.number} paga: previsto ${formatMoney(installment.plannedAmount)}, pago ${formatMoney(paidAmount)}`

  return {
    installment: { ...installment, status: 'Paid', paidAmount, paidDate: paymentDate },
    event: {
      date: paymentDate,
      kind: 'InstallmentPaid',
      origin: { kind: 'Liability', liabilityId: installment.liabilityId },
      description,
    },
  }
}
