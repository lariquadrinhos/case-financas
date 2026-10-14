/**
 * `GET, POST /api/v1/investments` — Investimentos.
 *
 * `accumulatedValue` is opening balance plus contributions, with NO
 * mark-to-market (PRD §1, §5): this route stores exactly the integer it is
 * given, never a computed valuation.
 */

import { cents } from '@/domain/core'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { created, list, resourcePath } from '@/api/http'
import { investmentQuerySchema, newInvestmentSchema } from '@/api/contracts/investments'

export const GET = handler({
  operation: 'investments.list',
  query: investmentQuerySchema,
  handle: async ({ session, query }) => {
    const { investmentReader } = getRepositories()
    const items =
      query.entity === undefined
        ? await investmentReader.list(session.userId)
        : await investmentReader.listByEntity(session.userId, query.entity)
    return list(items)
  },
})

export const POST = handler({
  operation: 'investments.create',
  body: newInvestmentSchema,
  handle: async ({ session, body }) => {
    const { investmentWriter } = getRepositories()
    const stored = await investmentWriter.create(session.userId, {
      name: body.name,
      entity: body.entity,
      accumulatedValue: cents(body.accumulatedValue),
    })
    return created(resourcePath('investments', stored.id), stored)
  },
})
