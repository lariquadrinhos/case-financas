/**
 * Relatórios — `/api/v1/reports/*`.
 *
 * Read-only, and that is structural, not a limitation: no report is the source
 * of anything. Deleting every report and recomputing gives the same numbers,
 * because they are projections over the Lançamentos (docs/ARCHITECTURE.md §1).
 * There is no POST here and there never will be.
 *
 * The four screens share two parameters (files_design/03 "Relatórios —
 * parâmetros comuns"): Visão always, Mês everywhere except the Balanço, which is
 * always the position of the present moment.
 */

import { INDICATOR_KEYS, INDICATOR_UNITS, MONTHLY_TREND_RANGES } from '@/domain/reports'
import { registry, z } from '@/api/registry'
import { API_BASE_PATH } from '@/api/http'
import {
  centsSchema,
  entitySchema,
  entryStatusSchema,
  errorResponses,
  idSchema,
  isoDateSchema,
  monthSchema,
  viewSchema,
} from './common'

const json = (schema: z.ZodType) => ({ 'application/json': { schema } })
const TAG = 'Reports'

/* -------------------------------------------------------------------------
 * DRE
 * ---------------------------------------------------------------------- */

const statementLineSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('block'),
    key: idSchema,
    label: z.string(),
    amount: centsSchema,
    level: z.number().int().min(0),
    /** DRE expansível: o total por categoria do bloco, maior primeiro; soma = `amount`. */
    breakdown: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        amount: centsSchema,
        /** Simulação "olhinho": oculta, fora do total do bloco. Sem isto, o `parse` do cliente a descartava. */
        hidden: z.boolean().optional(),
      }),
    ),
  }),
  z.object({
    kind: z.literal('subtotal'),
    key: z.enum(['netRevenue', 'ebitda', 'ebit', 'netProfit']),
    label: z.string(),
    amount: centsSchema,
    level: z.number().int().min(0),
  }),
])

const incomeStatementRowSchema = z.object({
  source: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('Entry'), entryId: idSchema }),
    /** A Previsto de recorrência: uma ocorrência, não um Lançamento (ADR-0019). */
    z.object({
      kind: z.literal('Occurrence'),
      occurrenceId: z.string().min(1),
      recurrenceId: idSchema,
    }),
    /**
     * `liabilityId` travels with the parcela because the DRE row's two actions
     * need it: Figma 11:2 nó `235:70` draws "Marcar Pago" (`235:72`) and
     * "Editar" (`235:74`) on the parcela row, and Editar goes to Detalhe do
     * Passivo (Figma 91:2), which an installment id alone cannot address.
     */
    z.object({
      kind: z.literal('Installment'),
      installmentId: idSchema,
      liabilityId: idSchema,
    }),
  ]),
  name: z.string(),
  /**
   * files_design/07 "Hierarquia de cor" — the PF/PJ etiqueta next to the row's
   * name, confirmed over the wireframe by docs/PERGUNTAS-EM-ABERTO.md P32.
   */
  entity: entitySchema,
  /**
   * `null` for pró-labore/distribuição, which carry a role instead of a
   * Categoria. Travels so a reader identifies a category by its stable id
   * rather than by `name`, which the person can rename at any time
   * (docs/PERGUNTAS-EM-ABERTO.md P22).
   */
  categoryId: idSchema.nullable(),
  blockId: idSchema,
  blockName: z.string(),
  status: entryStatusSchema,
  amount: centsSchema,
  description: z.string().nullable().optional(),
  recurring: z.boolean().optional(),
  /** "Cartão de crédito" (ADR-0021). No schema, ou o `parse` do cliente o descarta. */
  isCreditCard: z.boolean().optional(),
  /** A data do lançamento; ausente na parcela de Passivo. */
  date: isoDateSchema.optional(),
  /**
   * Simulação "olhinho" (2026-10-01). Medido: sem este campo, o `parse` do
   * cliente descartava a marca e o olho nunca fechava na tela.
   */
  hidden: z.boolean().optional(),
  /** Mês "a definir" em branco. Sem isto no schema, o `parse` do cliente o descartaria. */
  amountToBeDefined: z.boolean().optional(),
  /** (+) entrada ou (−) saída nesta visão (2026-10-01). No schema, ou o `parse` do cliente o descarta. */
  flow: z.enum(['In', 'Out']).optional(),
})

export const incomeStatementSchema = registry.register(
  'IncomeStatement',
  z.object({
    month: monthSchema,
    view: viewSchema,
    statusFilter: entryStatusSchema,
    forecast: z.boolean(),
    lines: z.array(statementLineSchema),
    netProfit: centsSchema,
    /** "Lançamentos deste mês" always shows Pago AND Previsto, whatever the toggle says. */
    rows: z.array(incomeStatementRowSchema),
  }),
)

/**
 * `statusFilter` has no server default on purpose. The screen's default is "Pago
 * em mês atual/passado, Previsto em mês futuro" (files_design/03), and deciding
 * that requires knowing what "today" is — which the server does not read
 * (src/domain/README.md: the domain never reads a clock).
 */
export const incomeStatementQuerySchema = z.strictObject({
  month: monthSchema,
  view: viewSchema,
  statusFilter: entryStatusSchema,
  /** "Ver previsão do mês": pago e previsto juntos; `statusFilter` deixa de restringir. */
  forecast: z.enum(['true', 'false']).default('false'),
  /**
   * Filtros "Recorrentes" e "Cartão" do DRE (ADR-0021): a cascata é
   * recalculada só com o que bate. Os dois juntos exigem os dois.
   */
  recurring: z.enum(['true', 'false']).default('false'),
  creditCard: z.enum(['true', 'false']).default('false'),
  /**
   * Simulação "olhinho" (2026-10-01): o que sai da cascata, separado por
   * vírgula — `entry:<id>`, `occurrence:<id>`, `installment:<id>` ou
   * `group:<chave do detalhamento>` (`group:category:<id>`, `group:kind:<…>`,
   * `group:liability:<id>`). Nada é gravado.
   */
  hidden: z
    .string()
    .regex(
      /^(?:(?:entry|occurrence|installment):[^,]+|group:(?:category|kind|liability):[^,]+)(?:,(?:(?:entry|occurrence|installment):[^,]+|group:(?:category|kind|liability):[^,]+))*$/,
    )
    .optional(),
})

/* -------------------------------------------------------------------------
 * Balanço Patrimonial
 * ---------------------------------------------------------------------- */

const balanceSheetItemSchema = z.object({
  source: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('BankAccount'), bankAccountId: idSchema }),
    z.object({ kind: z.literal('Investment'), investmentId: idSchema }),
    z.object({ kind: z.literal('TangibleAsset'), tangibleAssetId: idSchema }),
    z.object({ kind: z.literal('Liability'), liabilityId: idSchema }),
  ]),
  label: z.string(),
  /**
   * The PF/PJ etiqueta drawn under the item's name in "Detalhe do Bloco"
   * (docs/figma/frames/345-252, nós 189:35 e 189:40).
   */
  entity: entitySchema,
  amount: centsSchema,
})

const balanceSheetGroupSchema = z.object({
  total: centsSchema,
  items: z.array(balanceSheetItemSchema),
})

export const balanceSheetSchema = registry.register(
  'BalanceSheet',
  z.object({
    view: viewSchema,
    /** The day the photo was taken; the screen prints "posição em 20/07/2026". */
    asOf: isoDateSchema,
    currentAssets: balanceSheetGroupSchema,
    nonCurrentAssets: balanceSheetGroupSchema,
    currentLiabilities: balanceSheetGroupSchema,
    nonCurrentLiabilities: balanceSheetGroupSchema,
    totalAssets: centsSchema,
    totalLiabilities: centsSchema,
    netWorth: centsSchema,
  }),
)

/** `asOf` is a parameter, not a server clock read: the caller says which day the photo is of. */
export const balanceSheetQuerySchema = z.strictObject({
  view: viewSchema,
  asOf: isoDateSchema,
})

/* -------------------------------------------------------------------------
 * Evolução Mensal
 * ---------------------------------------------------------------------- */

export const monthlyTrendSchema = registry.register(
  'MonthlyTrend',
  z.object({
    view: viewSchema,
    range: z.enum(MONTHLY_TREND_RANGES),
    points: z.array(
      z.object({
        month: monthSchema,
        revenue: centsSchema,
        ebitda: centsSchema,
        /** Equal to EBITDA every month while D&A is zero (PRD §5); kept for fidelity. */
        ebit: centsSchema,
        netProfit: centsSchema,
        netWorth: centsSchema,
        /**
         * `true` só onde o PL daquele mês é ESTIMADO — a caminhada para trás a
         * partir do Balanço de hoje. `false` onde ele é medido: o mês `until`,
         * e todo mês coberto por um retrato mensal do PL (ADR-0016).
         */
        netWorthIsReconstructed: z.boolean(),
      }),
    ),
  }),
)

export const monthlyTrendQuerySchema = z
  .strictObject({
    view: viewSchema,
    range: z.enum(MONTHLY_TREND_RANGES).default('LastSixMonths'),
    /** The last month of the window. The server does not know "today". */
    until: monthSchema,
    /**
     * The day `currentNetWorth` is a photo of — same field, same reason, as
     * `balanceSheetQuerySchema.asOf` below: `computeMonthlyTrend`'s header
     * comment reads it as "as of now (`until`'s end)", and only the client knows
     * what "now" is.
     */
    asOf: isoDateSchema,
  })
  /**
   * The two have to describe the same moment, and nothing used to check it.
   * `currentNetWorth` is the Balanço at `asOf`, and `computeMonthlyTrend`
   * rebuilds the WHOLE series backward from it — so an `asOf` outside `until`
   * pins today's patrimônio to a past month's end and every earlier point
   * inherits the error, silently, off by all the profit between the two
   * (P21). Refused here, at the boundary, for the same reason
   * `newLiabilitySchema` checks its pair here: the request is well-formed but
   * its values break a rule, which is a 422.
   */
  .refine((query) => query.asOf.slice(0, 7) === query.until, {
    path: ['asOf'],
    error: 'as_of_outside_until_month',
  })

/* -------------------------------------------------------------------------
 * Indicadores Financeiros
 * ---------------------------------------------------------------------- */

/**
 * `value` is `null` whenever the denominator is zero — the screen shows a dash,
 * because "0%" and "NaN%" are two different lies (core/money `percentOf`).
 */
const indicatorSchema = z.object({
  key: z.enum(INDICATOR_KEYS),
  label: z.string(),
  unit: z.enum(INDICATOR_UNITS),
  value: z.number().nullable(),
})

export const financialIndicatorsSchema = registry.register(
  'FinancialIndicators',
  z.object({
    month: monthSchema,
    view: viewSchema,
    profitability: z.array(indicatorSchema),
    liquidity: z.array(indicatorSchema),
    leverage: z.array(indicatorSchema),
    netWorthGrowth: z.array(indicatorSchema),
    financialQualityOfLife: z.array(indicatorSchema),
  }),
)

/**
 * `statusFilter` is required, with no server default — same reasoning as
 * `incomeStatementQuerySchema` above. files_design/08 §10 says a future month
 * recalculates the 18 indicators "com base em lançamentos Previsto" and the
 * Event Storming (Fluxo G, UC34) names Indicadores Financeiros as one of the
 * three screens the Pago/Previsto toggle drives, alongside the DRE and
 * Entradas e Saídas — the query was missing the field the spec requires.
 */
export const financialIndicatorsQuerySchema = z.strictObject({
  month: monthSchema,
  view: viewSchema,
  statusFilter: entryStatusSchema,
  /**
   * `computeFinancialIndicators`'s `balanceSheet` input is documented as
   * "`computeBalanceSheet` for `view`, 'now'" — the Balanço has no history
   * (PRD §5), so every leverage/liquidity/ROE/Crescimento do PL indicator
   * reads the CURRENT position even when `month` is a past or future one.
   * Same field, same reason, as `balanceSheetQuerySchema.asOf`.
   */
  asOf: isoDateSchema,
})

/* -------------------------------------------------------------------------
 * Routes
 * ---------------------------------------------------------------------- */

registry.registerPath({
  method: 'get',
  path: `${API_BASE_PATH}/reports/income-statement`,
  tags: [TAG],
  summary: 'DRE de um mês, numa visão',
  request: { query: incomeStatementQuerySchema },
  responses: {
    200: { description: 'Cascata e lançamentos do mês.', content: json(incomeStatementSchema) },
    ...errorResponses(422),
  },
})

registry.registerPath({
  method: 'get',
  path: `${API_BASE_PATH}/reports/balance-sheet`,
  tags: [TAG],
  summary: 'Balanço Patrimonial na data informada',
  request: { query: balanceSheetQuerySchema },
  responses: {
    200: { description: 'Posição patrimonial.', content: json(balanceSheetSchema) },
    ...errorResponses(422),
  },
})

registry.registerPath({
  method: 'get',
  path: `${API_BASE_PATH}/reports/monthly-trend`,
  tags: [TAG],
  summary: 'Evolução Mensal',
  request: { query: monthlyTrendQuerySchema },
  responses: {
    200: { description: 'Série mensal.', content: json(monthlyTrendSchema) },
    ...errorResponses(422),
  },
})

registry.registerPath({
  method: 'get',
  path: `${API_BASE_PATH}/reports/indicators`,
  tags: [TAG],
  summary: 'Indicadores Financeiros',
  request: { query: financialIndicatorsQuerySchema },
  responses: {
    200: {
      description: 'Os 18 indicadores, por família.',
      content: json(financialIndicatorsSchema),
    },
    ...errorResponses(422),
  },
})
