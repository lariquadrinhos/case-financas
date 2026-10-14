/**
 * `GET, PUT /api/v1/discretionary-spending/config` — Consumo Livre, Estado A
 * "Configurar" (files_design/01 §4a).
 *
 * A singleton per person (data/contracts/discretionary-spending.ts): `PUT` is
 * always an upsert, whether this is the first configuration or "Editar valor
 * e conta" reopening the same two fields.
 */

import { asId, cents, type BankAccountId } from '@/domain/core'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { NotFoundError, ok } from '@/api/http'
import { discretionarySpendingConfigPutSchema } from '@/api/contracts/discretionary-spending'

export const GET = handler({
  operation: 'discretionary_spending.read_config',
  handle: async ({ session }) => {
    const { discretionarySpendingConfigReader } = getRepositories()
    const config = await discretionarySpendingConfigReader.find(session.userId)
    if (config === null) {
      throw new NotFoundError('O Consumo Livre ainda não foi configurado.')
    }
    return ok(config)
  },
})

export const PUT = handler({
  operation: 'discretionary_spending.save_config',
  body: discretionarySpendingConfigPutSchema,
  handle: async ({ session, body }) => {
    const { discretionarySpendingConfigWriter } = getRepositories()
    const saved = await discretionarySpendingConfigWriter.save(session.userId, {
      monthlyAmount: cents(body.monthlyAmount),
      sourceAccountId: asId<BankAccountId>(body.sourceAccountId),
      entity: body.entity,
      allowanceKind: body.allowanceKind,
    })
    return ok(saved)
  },
})
