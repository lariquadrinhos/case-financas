/**
 * `GET /api/v1/reports/balance-sheet` — Balanço Patrimonial (files_design/01
 * §8.2).
 *
 * A photo of `asOf`, never a series — there is no month selector on this
 * screen (files_design/03 "Relatórios — parâmetros comuns").
 */

import { isoDate } from '@/domain/core'
import { computeBalanceSheet } from '@/domain/reports'
import { handler } from '@/api/handler'
import { ok } from '@/api/http'
import { balanceSheetQuerySchema } from '@/api/contracts/reports'
import { loadPatrimonio } from '../_assemble'

export const GET = handler({
  operation: 'reports.balance_sheet',
  query: balanceSheetQuerySchema,
  handle: async ({ session, query }) => {
    const patrimonio = await loadPatrimonio(session.userId)
    const sheet = computeBalanceSheet({
      asOf: isoDate(query.asOf),
      view: query.view,
      ...patrimonio,
    })
    return ok(sheet)
  },
})
