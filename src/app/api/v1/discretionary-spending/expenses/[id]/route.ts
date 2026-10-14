/**
 * `PATCH, DELETE /api/v1/discretionary-spending/expenses/{id}` — editing a
 * gasto from the widget's own history (files_design/01 §4a, Estado C).
 *
 * "Campos editáveis: Valor, e opcionalmente Rótulo" — never the date, the
 * account, the category or the entity, which is why `PATCH` merges only
 * those two fields onto what is already stored, rather than accepting a
 * caller-supplied replacement for the rest.
 */

import { asId, cents, type EntryId } from '@/domain/core'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { NotFoundError, noContent, ok } from '@/api/http'
import { discretionaryExpensePatchSchema } from '@/api/contracts/discretionary-spending'
import { idParams } from '@/api/contracts/common'

export const PATCH = handler({
  operation: 'discretionary_spending.update_expense',
  params: idParams,
  body: discretionaryExpensePatchSchema,
  handle: async ({ session, params, body }) => {
    const { discretionaryExpenseReader, discretionaryExpenseWriter } = getRepositories()
    const expenseId = asId<EntryId>(params.id)

    const existing = await discretionaryExpenseReader.findById(session.userId, expenseId)
    if (existing === null) {
      throw new NotFoundError('O gasto de Consumo Livre solicitado não existe.')
    }

    const updated = {
      ...existing,
      amount: body.amount !== undefined ? cents(body.amount) : existing.amount,
      // `label` is nullable (clearing it is a valid edit) — `??` would treat an
      // explicit `null` the same as "not sent", so only `undefined` falls back.
      label: body.label !== undefined ? body.label : existing.label,
    }
    const stored = await discretionaryExpenseWriter.replace(session.userId, updated)
    return ok(stored)
  },
})

export const DELETE = handler({
  operation: 'discretionary_spending.remove_expense',
  params: idParams,
  handle: async ({ session, params }) => {
    const { discretionaryExpenseWriter } = getRepositories()
    await discretionaryExpenseWriter.remove(session.userId, asId<EntryId>(params.id))
    return noContent()
  },
})
