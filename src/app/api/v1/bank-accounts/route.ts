/**
 * `GET, POST /api/v1/bank-accounts` — Contas Bancárias.
 *
 * `balance` is kept BY THE PERSON (PRD §1): this route stores exactly the
 * integer of cents it is given, with no aggregation from lançamentos.
 */

import { cents } from '@/domain/core'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { created, list, resourcePath } from '@/api/http'
import { bankAccountQuerySchema, newBankAccountSchema } from '@/api/contracts/bank-accounts'

export const GET = handler({
  operation: 'bank_accounts.list',
  query: bankAccountQuerySchema,
  handle: async ({ session, query }) => {
    const { bankAccountReader } = getRepositories()
    const items =
      query.entity === undefined
        ? await bankAccountReader.list(session.userId)
        : await bankAccountReader.listByEntity(session.userId, query.entity)
    return list(items)
  },
})

export const POST = handler({
  operation: 'bank_accounts.create',
  body: newBankAccountSchema,
  handle: async ({ session, body }) => {
    const { bankAccountWriter } = getRepositories()
    const stored = await bankAccountWriter.create(session.userId, {
      label: body.label,
      colour: body.colour,
      entity: body.entity,
      balance: cents(body.balance),
    })
    return created(resourcePath('bank-accounts', stored.id), stored)
  },
})
