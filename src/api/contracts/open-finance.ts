/**
 * Open Finance — `/api/v1/open-finance` (ADR-0020).
 *
 * Three things the person or the app does: see the accounts the bank reports
 * and what each is linked to, link or unlink one, and sync. There is no
 * "connect a bank" here: the connection lives in the Meu Pluggy, outside the
 * app (ADR-0020 §1).
 */

import { OPEN_FINANCE_ACCOUNT_KINDS } from '@/domain/open-finance'
import { registry, z } from '@/api/registry'
import { API_BASE_PATH } from '@/api/http'
import {
  centsSchema,
  entitySchema,
  errorResponses,
  idSchema,
  isoDateSchema,
  monthSchema,
} from './common'

const json = (schema: z.ZodType) => ({ 'application/json': { schema } })
const TAG = 'Open Finance'

export const openFinanceLinkTargetSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('BankAccount'), bankAccountId: idSchema }),
    z.strictObject({ kind: z.literal('CreditCard'), paidByBankAccountId: idSchema }),
    z.strictObject({ kind: z.literal('Investment'), investmentId: idSchema }),
  ])
  .openapi({
    description:
      'Para onde a conta do banco aponta: uma Conta Bancária, a conta que paga um cartão, ou um Investimento.',
  })

export const openFinanceAccountSchema = registry.register(
  'OpenFinanceAccount',
  z.object({
    id: idSchema,
    kind: z.enum(OPEN_FINANCE_ACCOUNT_KINDS),
    name: z.string(),
    numberSuffix: z.string().nullable(),
    institution: z.string().nullable(),
    balance: centsSchema,
    link: z.object({ target: openFinanceLinkTargetSchema, linkedOn: isoDateSchema }).nullable(),
  }),
)

export const openFinanceLinkBodySchema = registry.register(
  'OpenFinanceLinkBody',
  z.strictObject({ target: openFinanceLinkTargetSchema }),
)

export const providerAccountParams = z.strictObject({ providerAccountId: idSchema })

/** "Criar e vincular": the entity is the one thing the bank does not tell (ADR-0020 §3). */
export const createPositionBodySchema = registry.register(
  'OpenFinanceCreatePositionBody',
  z.strictObject({ entity: entitySchema }),
)

export const openFinanceSyncBodySchema = registry.register(
  'OpenFinanceSyncBody',
  z.strictObject({
    /** Ignores the minimum interval between syncs (PRD P53). */
    force: z.boolean().default(false),
  }),
)

const IMPORT_KINDS = [
  'DiscretionaryExpense',
  'PayPlanned',
  'Transfer',
  'CardPurchase',
  'CardBillPayment',
  'Entry',
  'Ignored',
] as const

export const openFinanceSyncResultSchema = registry.register(
  'OpenFinanceSyncResult',
  z.discriminatedUnion('status', [
    z.object({
      status: z.literal('Synced'),
      balancesUpdated: z.number().int(),
      imported: z.record(z.enum(IMPORT_KINDS), z.number().int()),
    }),
    z.object({ status: z.literal('Skipped'), lastSyncedAt: z.string() }),
    /** The person turned the automatic sync off (2026-10-01); only `force` reads the bank. */
    z.object({ status: z.literal('Paused') }),
  ]),
)

export const openFinanceSyncStatusSchema = registry.register(
  'OpenFinanceSyncStatus',
  z.object({ lastSyncedAt: z.string().nullable(), autoSync: z.boolean() }),
)

/** "Sincronizar ao abrir o app" — liga ou desliga a sincronização automática. */
export const openFinanceAutoSyncBodySchema = registry.register(
  'OpenFinanceAutoSyncBody',
  z.strictObject({ enabled: z.boolean() }),
)

const base = `${API_BASE_PATH}/open-finance`

registry.registerPath({
  method: 'get',
  path: `${base}/sync`,
  tags: [TAG],
  summary: 'Quando foi a última sincronização',
  responses: {
    200: { description: 'Instante ISO, ou null.', content: json(openFinanceSyncStatusSchema) },
    ...errorResponses(),
  },
})

registry.registerPath({
  method: 'get',
  path: `${base}/month-movement`,
  tags: [TAG],
  summary: 'Entradas − saídas do extrato do mês, por Conta Bancária vinculada',
  description:
    'O "Caixa do mês" do DRE chega ao saldo do dia 1º com isto: saldo de hoje menos o movimento. Lê o provedor.',
  request: { query: z.strictObject({ month: monthSchema }) },
  responses: {
    200: {
      description: 'Movimento por conta.',
      content: json(
        z.object({ data: z.array(z.object({ bankAccountId: z.string(), movement: centsSchema })) }),
      ),
    },
    ...errorResponses(409),
  },
})

registry.registerPath({
  method: 'get',
  path: `${base}/accounts`,
  tags: [TAG],
  summary: 'Contas que o banco informa, e o vínculo de cada uma',
  responses: {
    200: {
      description: 'Contas do Open Finance.',
      content: json(z.object({ data: z.array(openFinanceAccountSchema) })),
    },
    ...errorResponses(409),
  },
})

registry.registerPath({
  method: 'get',
  path: `${base}/accounts/{providerAccountId}/transactions`,
  tags: [TAG],
  summary: 'Movimentos do mês de uma conta do banco, e o que cada um virou no Bigorna',
  request: { params: providerAccountParams },
  responses: {
    200: {
      description: 'Movimentos, do mais recente ao mais antigo.',
      content: json(
        z.object({
          data: z.array(
            z.object({
              id: idSchema,
              date: isoDateSchema,
              description: z.string(),
              amount: centsSchema,
              direction: z.enum(['In', 'Out']),
              providerCategory: z.string().nullable(),
              outcome: z.string().nullable(),
            }),
          ),
        }),
      ),
    },
    ...errorResponses(404, 409),
  },
})

registry.registerPath({
  method: 'get',
  path: `${base}/entry-origins`,
  tags: [TAG],
  summary: 'Descrição e categoria do banco de cada lançamento importado do mês',
  request: { query: z.strictObject({ month: z.string() }) },
  responses: {
    200: {
      description: 'Uma linha por lançamento que veio do banco.',
      content: json(
        z.object({
          data: z.array(
            z.object({
              entryId: idSchema,
              kind: z.string(),
              date: isoDateSchema,
              description: z.string(),
              providerCategory: z.string().nullable(),
            }),
          ),
        }),
      ),
    },
    ...errorResponses(422),
  },
})

registry.registerPath({
  method: 'put',
  path: `${base}/links/{providerAccountId}`,
  tags: [TAG],
  summary: 'Vincula uma conta do banco a uma posição do Bigorna',
  request: {
    params: providerAccountParams,
    body: { content: json(openFinanceLinkBodySchema) },
  },
  responses: {
    200: { description: 'Vínculo salvo.', content: json(openFinanceAccountSchema) },
    ...errorResponses(404, 409, 422),
  },
})

registry.registerPath({
  method: 'post',
  path: `${base}/links/{providerAccountId}/position`,
  tags: [TAG],
  summary: 'Cria a Conta Bancária ou o Investimento a partir da conta do banco, e vincula',
  request: {
    params: providerAccountParams,
    body: { content: json(createPositionBodySchema) },
  },
  responses: {
    201: { description: 'Posição criada e vinculada.' },
    ...errorResponses(404, 409, 422),
  },
})

registry.registerPath({
  method: 'post',
  path: `${base}/reimport`,
  tags: [TAG],
  summary: 'Desfaz o que a importação criou e importa de novo com as regras de agora',
  responses: {
    200: { description: 'Resultado da reimportação.', content: json(openFinanceSyncResultSchema) },
    ...errorResponses(409),
  },
})

registry.registerPath({
  method: 'delete',
  path: `${base}/links/{providerAccountId}`,
  tags: [TAG],
  summary: 'Desvincula uma conta do banco',
  request: { params: providerAccountParams },
  responses: { 204: { description: 'Vínculo removido.' }, ...errorResponses() },
})

registry.registerPath({
  method: 'put',
  path: `${base}/auto-sync`,
  tags: [TAG],
  summary: 'Liga ou desliga a sincronização automática ao abrir o app',
  description:
    'Desligada, `POST /sync` sem `force` responde `Paused` sem ler o banco. "Sincronizar agora" (`force: true`) continua funcionando. O que já foi importado e os vínculos ficam.',
  request: { body: { content: json(openFinanceAutoSyncBodySchema), required: true } },
  responses: {
    200: { description: 'Preferência gravada.', content: json(openFinanceAutoSyncBodySchema) },
    ...errorResponses(422),
  },
})

registry.registerPath({
  method: 'post',
  path: `${base}/sync`,
  tags: [TAG],
  summary: 'Lê o banco e importa o que chegou desde a última vez',
  request: { body: { content: json(openFinanceSyncBodySchema) } },
  responses: {
    200: { description: 'Resultado da sincronização.', content: json(openFinanceSyncResultSchema) },
    ...errorResponses(409),
  },
})
