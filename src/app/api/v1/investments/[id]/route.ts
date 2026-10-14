/**
 * `GET, PATCH, DELETE /api/v1/investments/{id}`.
 */

import type { Investment } from '@/domain/assets'
import { asId, cents, type InvestmentId } from '@/domain/core'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { assertBalanceIsManual } from '@/api/open-finance'
import { NotFoundError, noContent, ok } from '@/api/http'
import { investmentPatchSchema } from '@/api/contracts/investments'
import { idParams } from '@/api/contracts/common'

export const GET = handler({
  operation: 'investments.read',
  params: idParams,
  handle: async ({ session, params }) => {
    const { investmentReader } = getRepositories()
    const investment = await investmentReader.findById(
      session.userId,
      asId<InvestmentId>(params.id),
    )
    if (investment === null) {
      throw new NotFoundError('O investimento solicitado não existe.')
    }
    return ok(investment)
  },
})

export const PATCH = handler({
  operation: 'investments.update',
  params: idParams,
  body: investmentPatchSchema,
  handle: async ({ session, params, body }) => {
    const { investmentReader, investmentWriter } = getRepositories()
    const investmentId = asId<InvestmentId>(params.id)
    const existing = await investmentReader.findById(session.userId, investmentId)
    if (existing === null) {
      throw new NotFoundError('O investimento solicitado não existe.')
    }
    // ADR-0020 §3: num investimento vinculado, o saldo vem do banco.
    if (
      body.accumulatedValue !== undefined &&
      body.accumulatedValue !== existing.accumulatedValue
    ) {
      await assertBalanceIsManual(getRepositories(), session.userId, {
        kind: 'Investment',
        id: investmentId,
      })
    }

    const updated: Investment = {
      ...existing,
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.entity !== undefined ? { entity: body.entity } : {}),
      ...(body.accumulatedValue !== undefined
        ? { accumulatedValue: cents(body.accumulatedValue) }
        : {}),
    }
    const stored = await investmentWriter.replace(session.userId, updated)
    return ok(stored)
  },
})

export const DELETE = handler({
  operation: 'investments.remove',
  params: idParams,
  handle: async ({ session, params }) => {
    const { investmentReader, investmentWriter } = getRepositories()
    const investmentId = asId<InvestmentId>(params.id)
    const existing = await investmentReader.findById(session.userId, investmentId)
    if (existing === null) {
      throw new NotFoundError('O investimento solicitado não existe.')
    }
    await investmentWriter.remove(session.userId, investmentId)
    return noContent()
  },
})
