/**
 * `GET, POST /api/v1/discretionary-spending/expenses` — Consumo Livre, o
 * histórico do mês e o popover "Gastei um valor" (files_design/01 §4a).
 *
 * `POST` asks for the amount (and the date the screen sends as "hoje") only:
 * the account, the category and the entity are assembled by the repository
 * from the widget's configuration (`buildExpenseEntry`,
 * src/domain/discretionary-spending/rules.ts) — never from the request body.
 */

import { cents, isoDate, month } from '@/domain/core'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { assertManualPaidAllowed } from '@/api/open-finance'
import { created, list, resourcePath } from '@/api/http'
import { monthSchema } from '@/api/contracts/common'
import { newDiscretionaryExpenseSchema } from '@/api/contracts/discretionary-spending'
import { z } from '@/api/registry'

export const GET = handler({
  operation: 'discretionary_spending.list_expenses',
  query: z.strictObject({ month: monthSchema }),
  handle: async ({ session, query }) => {
    const { discretionaryExpenseReader } = getRepositories()
    const expenses = await discretionaryExpenseReader.listByMonth(
      session.userId,
      month(query.month),
    )
    return list(expenses)
  },
})

export const POST = handler({
  operation: 'discretionary_spending.create_expense',
  body: newDiscretionaryExpenseSchema,
  handle: async ({ session, body }) => {
    const repos = getRepositories()
    const { discretionaryExpenseWriter } = repos
    // PRD P48, decided 2026-09-29: with the conta de origem linked, every
    // expense of the widget arrives from the bank — one typed here would be
    // counted twice.
    const config = await repos.discretionarySpendingConfigReader.find(session.userId)
    if (config !== null) {
      await assertManualPaidAllowed(repos, session.userId, {
        kind: 'Expense',
        status: 'Paid',
        date: isoDate(body.date),
        bankAccountId: config.sourceAccountId,
      })
    }
    const stored = await discretionaryExpenseWriter.create(session.userId, {
      date: isoDate(body.date),
      amount: cents(body.amount),
      label: body.label,
    })
    return created(resourcePath('discretionary-spending', 'expenses', stored.id), stored)
  },
})
