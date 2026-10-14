/**
 * Passivos — `/api/v1/liabilities`, plus the two sub-resources the Detalhe do
 * Passivo screen drives: the amortisation schedule and the rate adjustments.
 *
 * The ten form fields are transcribed from files_design/03 "Passivos (formulário
 * completo)". A Parcela is NEVER created by a client: the schedule is generated
 * from the form and recomputed on every rate adjustment ("calculado por
 * amortização", §6: "não digitado pela pessoa"), so `/installments` is read-only
 * except for the payment action.
 *
 * Liabilities are 100% manual (Event Storming H9): paying an expense does not
 * amortise a debt.
 */

import { registry, z } from '@/api/registry'
import { API_BASE_PATH } from '@/api/http'
import {
  centsSchema,
  classificationSchema,
  entitySchema,
  entityWithDefault,
  errorResponses,
  idParams,
  idSchema,
  isoDateSchema,
  listEnvelope,
  monthlyRateSchema,
  nonNegativeIntSchema,
  positiveIntSchema,
  registerResource,
  shortTextSchema,
  entryStatusSchema,
} from './common'

export const liabilitySchema = registry.register(
  'Liability',
  z.object({
    id: idSchema,
    name: z.string(),
    creditor: z.string(),
    entity: entitySchema,
    classification: classificationSchema,
    originalAmount: centsSchema,
    installmentAmount: centsSchema,
    installmentCount: positiveIntSchema,
    installmentsAlreadyPaid: nonNegativeIntSchema,
    monthlyInterestRate: monthlyRateSchema,
    startDate: isoDateSchema,
    /**
     * DERIVADO, nunca armazenado: o principal em aberto, isto é, o valor
     * presente das parcelas ainda Previstas descontadas à taxa vigente
     * (`outstandingBalance`, @/domain/assets). Entra na resposta porque a
     * lista de Passivos DESENHA esse número, não o valor original — Wireframe
     * `40:2`, nó `90:66` "Saldo devedor" sobre `90:67`, e o Mockup repete em
     * `933:1416` (`934:71`..`934:75`). Sem ele no contrato a tela teria de
     * baixar o cronograma inteiro de cada passivo só para escrever uma linha.
     */
    outstandingBalance: centsSchema,
  }),
)

/**
 * "Parcelas já pagas" pre-populates the history of a debt already under way
 * (files_design/03) — above the total it describes nothing. Checked HERE, at the
 * boundary, so the request is refused before a row is written: the same pair is
 * a CHECK constraint in `schema.ts`, and reaching it turns a fixable 422 into a
 * 500.
 */
const installmentsAlreadyPaidWithinCount = (value: {
  installmentCount: number
  installmentsAlreadyPaid: number
}) => value.installmentsAlreadyPaid <= value.installmentCount

const liabilityFields = z.strictObject({
  name: shortTextSchema,
  creditor: shortTextSchema,
  entity: entityWithDefault,
  /**
   * Suggested from a keyword in the name and editable — exception 3, so it
   * carries a default rather than being absent (PERGUNTAS-EM-ABERTO P7).
   */
  classification: classificationSchema.default('NonCurrent'),
  originalAmount: centsSchema.min(0),
  installmentAmount: centsSchema.min(0),
  installmentCount: positiveIntSchema,
  /** Pre-populates the history when an ongoing debt is registered. Default 0. */
  installmentsAlreadyPaid: nonNegativeIntSchema.default(0),
  monthlyInterestRate: monthlyRateSchema,
  startDate: isoDateSchema,
})

export const newLiabilitySchema = registry.register(
  'NewLiability',
  liabilityFields.refine(installmentsAlreadyPaidWithinCount, {
    path: ['installmentsAlreadyPaid'],
    error: 'installments_already_paid_above_count',
  }),
)

/**
 * "Editar dados cadastrais" edits CADASTRO, never the shape of the schedule.
 *
 * The five omitted fields are exactly the inputs of `buildInstallmentSchedule`
 * (`@/domain/assets`): `originalAmount`, `installmentCount`,
 * `installmentsAlreadyPaid`, `startDate` and `monthlyInterestRate`. The design
 * names ONE trigger that regenerates a schedule, and names it in full: the
 * legend under the debt chart, Wireframe `91:2` node `91:98` — repeated
 * literally in the Mockup, `948:1687` node `949:72` — reads "Calculado
 * automaticamente com base na taxa de juros e no cronograma de amortização.
 * Recalculado a cada reajuste de juros registrado." The header draws the two
 * actions side by side and separate (`203:2`: `91:43` "Editar dados
 * cadastrais" and `91:58` "Registrar reajuste de juros"; Mockup `948:1838`,
 * buttons `948:1839`/`948:1841`), and only the second one has a screen of its
 * own carrying the recalculation warnings (`94:2`, nodes `339:2` and `94:56`).
 * The design note `164:2` (`164:4`) picks approach (A), "o sistema calcula a
 * amortização E RECALCULA A CADA REAJUSTE DE JUROS", and files_design/03 says
 * the same of "Valor previsto": "recalculado a cada reajuste de juros
 * registrado".
 *
 * Accepting them here left the screen contradicting itself, which the frame
 * forbids: `installmentCount` 360 → 400 printed "12 / 400 pagas" in the
 * "Parcelas" card (`91:56`/`948:2290`) over a list (`337:3`) that still had 360
 * rows and a footer (`91:132`/`950:71`) still counting on 360; and the
 * "Cadastro" event the history keeps forever — "Dívida cadastrada:
 * R$ 320.000,00, 360 parcelas, taxa inicial 0,80% a.m." (`950:85`) — would
 * become false with no event to explain it, since the event enum in
 * files_design/03 has only Cadastro, Reajuste de juros, Parcela paga and
 * Recorrência paga.
 *
 * `.strictObject` turns each of them into a 422 rather than a silent no-op.
 * "Valor da parcela" stays editable: it is declared cadastro and no input of
 * the calculation (see `buildInstallmentSchedule`).
 */
export const liabilityPatchSchema = registry.register(
  'LiabilityPatch',
  liabilityFields
    .omit({
      originalAmount: true,
      installmentCount: true,
      installmentsAlreadyPaid: true,
      monthlyInterestRate: true,
      startDate: true,
    })
    .partial(),
)

/** One row of the amortisation schedule. Generated, never posted by a client. */
export const installmentSchema = registry.register(
  'Installment',
  z.object({
    id: idSchema,
    liabilityId: idSchema,
    number: positiveIntSchema,
    plannedDate: isoDateSchema,
    plannedAmount: centsSchema,
    /** "Prevista" / "Paga" on this screen — the same two states as an entry. */
    status: entryStatusSchema,
    paidAmount: centsSchema.nullable(),
    /** Só quando Paga. É ela que define o mês contábil no DRE (P6/regime de caixa). */
    paidDate: isoDateSchema.nullable(),
    /**
     * "Descartar" pulou esta parcela na Revisão de Recorrentes deste mês
     * (Figma `10:2` nó 144:17); a série segue igual no mês seguinte (Figma
     * `34:2` nó 34:36). Mesmo campo, mesma semântica que
     * `occurrenceSchema.discarded`.
     */
    discarded: z.boolean(),
  }),
)

export const installmentPaymentSchema = registry.register(
  'InstallmentPayment',
  z.strictObject({
    paidAmount: centsSchema.min(0),
    paymentDate: isoDateSchema,
  }),
)

/**
 * "Registrar Reajuste de Juros". Recomputes every installment still Prevista
 * from `effectiveFrom`; an installment already paid is never rewritten
 * (files_design/03).
 */
export const rateAdjustmentSchema = registry.register(
  'RateAdjustment',
  z.strictObject({
    newRate: monthlyRateSchema,
    effectiveFrom: isoDateSchema,
  }),
)

const TAG = 'Liabilities'
const path = `${API_BASE_PATH}/liabilities`

registerResource({
  tag: TAG,
  resource: 'liabilities',
  singular: 'passivo',
  item: liabilitySchema,
  create: newLiabilitySchema,
  patch: liabilityPatchSchema,
  query: z.strictObject({ entity: entitySchema.optional() }),
  deletable: true,
})

registry.registerPath({
  method: 'get',
  path: `${path}/{id}/installments`,
  tags: [TAG],
  summary: 'Lista as parcelas de um passivo',
  request: { params: idParams },
  responses: {
    200: {
      description: 'Tabela de amortização.',
      content: { 'application/json': { schema: listEnvelope(installmentSchema) } },
    },
    ...errorResponses(404),
  },
})

registry.registerPath({
  method: 'post',
  path: `${path}/{id}/rate-adjustments`,
  tags: [TAG],
  summary: 'Registra um reajuste de juros',
  request: {
    params: idParams,
    body: { content: { 'application/json': { schema: rateAdjustmentSchema } }, required: true },
  },
  responses: {
    200: {
      description: 'Parcelas previstas recalculadas.',
      content: { 'application/json': { schema: listEnvelope(installmentSchema) } },
    },
    ...errorResponses(400, 404, 409, 422),
  },
})

/**
 * "Descartar" numa Parcela — a terceira ação da linha de Passivo na Revisão de
 * Recorrentes (Figma `10:2` nó 144:17). Acrescentada como rota nova, sem tocar
 * em nenhum handler existente (CLAUDE.md §4, "O" de SOLID), espelhando
 * `POST /occurrences/{id}/discard`.
 */
registry.registerPath({
  method: 'post',
  path: `${API_BASE_PATH}/installments/{id}/discard`,
  tags: [TAG],
  summary: 'Descarta a parcela deste mês',
  description:
    'Pula a parcela na revisão deste mês. O cronograma não se desloca e o saldo devedor não muda (Figma 34:2 nó 34:36).',
  request: { params: idParams },
  responses: {
    200: {
      description: 'Parcela descartada.',
      content: { 'application/json': { schema: installmentSchema } },
    },
    ...errorResponses(404, 409),
  },
})

registry.registerPath({
  method: 'post',
  path: `${API_BASE_PATH}/installments/{id}/payment`,
  tags: [TAG],
  summary: 'Marca uma parcela como paga',
  description: 'Pede o valor real pago; gera um Evento se divergir do previsto (files_design/03).',
  request: {
    params: idParams,
    body: { content: { 'application/json': { schema: installmentPaymentSchema } }, required: true },
  },
  responses: {
    200: {
      description: 'Parcela paga.',
      content: { 'application/json': { schema: installmentSchema } },
    },
    ...errorResponses(400, 404, 409, 422),
  },
})
