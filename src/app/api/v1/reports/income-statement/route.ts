/**
 * `GET /api/v1/reports/income-statement` — DRE (files_design/01 §8.1).
 *
 * Read-only, and structurally so (`src/api/contracts/reports.ts` header
 * comment): the cascade is a projection over the Lançamentos of the month,
 * recomputed on every request, never stored.
 */

import { month } from '@/domain/core'
import { computeIncomeStatement } from '@/domain/reports'
import { handler } from '@/api/handler'
import { ok } from '@/api/http'
import { incomeStatementQuerySchema } from '@/api/contracts/reports'
import {
  loadChartOfAccounts,
  loadEntriesForMonths,
  loadPatrimonio,
  loadToBeDefinedEntries,
  projectedEntryIdOf,
  withOccurrenceSources,
} from '../_assemble'

/**
 * `entry:a,occurrence:b,group:category:c` → os dois conjuntos do domínio. Um
 * mês de recorrência entra na cascata como lançamento projetado, e é pelo id
 * projetado que o domínio o reconhece.
 */
function hiddenFrom(raw: string): { rows: Set<string>; groups: Set<string> } {
  const rows = new Set<string>()
  const groups = new Set<string>()
  for (const token of raw.split(',')) {
    const colon = token.indexOf(':')
    const kind = token.slice(0, colon)
    const id = token.slice(colon + 1)
    if (kind === 'group') groups.add(id)
    else if (kind === 'occurrence') rows.add(projectedEntryIdOf(id))
    else rows.add(id)
  }
  return { rows, groups }
}

export const GET = handler({
  operation: 'reports.income_statement',
  query: incomeStatementQuerySchema,
  handle: async ({ session, query }) => {
    const targetMonth = month(query.month)

    // `loadEntriesForMonths`, not a raw `entryReader.listByMonth`: a future
    // month has no real Lançamento yet, only the projection from open
    // recorrências (UC29/UC34/UC42) — see its doc comment in `_assemble.ts`.
    // P6 (produto, 2026-09-08): a parcela de Passivo conta no DRE, então os
    // passivos e o cronograma vêm junto — o filtro por mês, status e visão é do
    // domínio, não daqui.
    const [monthEntries, toBeDefined, chart, patrimony] = await Promise.all([
      loadEntriesForMonths(session.userId, [targetMonth]),
      loadToBeDefinedEntries(session.userId, targetMonth),
      loadChartOfAccounts(session.userId),
      loadPatrimonio(session.userId),
    ])
    const entries = [...monthEntries, ...toBeDefined.entries]

    const statement = computeIncomeStatement({
      entries,
      chart,
      view: query.view,
      month: targetMonth,
      statusFilter: query.statusFilter,
      forecast: query.forecast === 'true',
      only: { recurring: query.recurring === 'true', creditCard: query.creditCard === 'true' },
      liabilities: patrimony.liabilities,
      installments: [...patrimony.installmentsByLiability.values()].flat(),
      ...(query.hidden !== undefined ? { hidden: hiddenFrom(query.hidden) } : {}),
    })
    return ok(withOccurrenceSources(statement, toBeDefined.occurrenceIds))
  },
})
