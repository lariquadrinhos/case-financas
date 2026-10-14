/**
 * `GET /api/v1/reports/monthly-trend` — Evolução Mensal (files_design/01
 * §8.3).
 *
 * `currentNetWorth` is the one input `computeMonthlyTrend` cannot derive from
 * `entries` alone — the Balanço has no history of its own (that file's header
 * comment) — so this route computes it here, the same way `balance-sheet`
 * does, and hands it in.
 *
 * P21: e os RETRATOS mensais do PL, que são o histórico que o Balanço não tem.
 * Eles são gravados quando o patrimônio muda (`src/data/net-worth-recording.ts`);
 * aqui só se lê. Mês sem retrato até ele herda o anterior; mês anterior ao
 * primeiro retrato continua reconstruído, e o ponto diz qual dos dois é.
 */

import { isoDate, month, type Cents, type Month } from '@/domain/core'
import { getRepositories } from '@/data'
import { computeBalanceSheet, computeMonthlyTrend, monthsForRange } from '@/domain/reports'
import { handler } from '@/api/handler'
import { ok } from '@/api/http'
import { monthlyTrendQuerySchema } from '@/api/contracts/reports'
import { loadChartOfAccounts, loadEntriesForMonths, loadPatrimonio } from '../_assemble'

export const GET = handler({
  operation: 'reports.monthly_trend',
  query: monthlyTrendQuerySchema,
  handle: async ({ session, query }) => {
    const until = month(query.until)
    const months = monthsForRange(query.range, until)

    const { netWorthSnapshotReader } = getRepositories()
    const [entries, chart, patrimonio, snapshots] = await Promise.all([
      loadEntriesForMonths(session.userId, months),
      loadChartOfAccounts(session.userId),
      loadPatrimonio(session.userId),
      netWorthSnapshotReader.listByView(session.userId, query.view),
    ])

    const currentNetWorth = computeBalanceSheet({
      asOf: isoDate(query.asOf),
      view: query.view,
      ...patrimonio,
    }).netWorth

    const trend = computeMonthlyTrend({
      view: query.view,
      range: query.range,
      until,
      entries,
      chart,
      currentNetWorth,
      netWorthSnapshots: new Map<Month, Cents>(
        snapshots.map((snapshot) => [snapshot.month, snapshot.netWorth]),
      ),
    })
    return ok(trend)
  },
})
