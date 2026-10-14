/**
 * `GET /api/v1/reports/indicators` — Indicadores Financeiros (files_design/01
 * §8.4, catalogue in files_design/08 §10).
 *
 * Dois números que `computeFinancialIndicators` não deriva de `entries` e
 * `assets` sozinho, e por isso nascem aqui (P22, fechada em 2026-09-11):
 *
 *  - `investmentContributionsThisMonth` vem de `profit-allocation`, que
 *    `reports` não pode importar (a regra de dependência do domínio), então
 *    esta rota soma os dois baldes do mês, uma vez;
 *  - `priorInvestmentsTotal` vem do retrato mensal — medido, não deduzido.
 */

import { add, isoDate, month, previousMonth } from '@/domain/core'
import { bucketSubtotal } from '@/domain/profit-allocation'
import {
  computeBalanceSheet,
  computeFinancialIndicators,
  computeIncomeStatement,
} from '@/domain/reports'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { ok } from '@/api/http'
import { financialIndicatorsQuerySchema } from '@/api/contracts/reports'
import { loadChartOfAccounts, loadEntriesForMonths, loadPatrimonio } from '../_assemble'

export const GET = handler({
  operation: 'reports.indicators',
  query: financialIndicatorsQuerySchema,
  handle: async ({ session, query }) => {
    const targetMonth = month(query.month)
    const { profitAllocationReader, netWorthSnapshotReader } = getRepositories()

    // `loadEntriesForMonths`, not a raw `entryReader.listByMonth`: UC42 asks
    // to navigate Indicadores Financeiros into a future month too, and that
    // needs the same recorrência projection the DRE uses (`_assemble.ts`).
    const [entries, chart, patrimonio, allocation] = await Promise.all([
      loadEntriesForMonths(session.userId, [targetMonth]),
      loadChartOfAccounts(session.userId),
      loadPatrimonio(session.userId),
      profitAllocationReader.findByMonth(session.userId, targetMonth),
    ])

    const statement = computeIncomeStatement({
      entries,
      chart,
      view: query.view,
      month: targetMonth,
      statusFilter: query.statusFilter,
    })

    const balanceSheet = computeBalanceSheet({
      asOf: isoDate(query.asOf),
      view: query.view,
      ...patrimonio,
    })

    // Which buckets count as "aporte" is a Destinação do Lucro rule, so the
    // sum comes from `bucketSubtotal` (@/domain/profit-allocation) instead of
    // being re-derived over `allocation.items` here: a handler delegates, it
    // does not own a domain rule (src/api/handler.ts header comment).
    const investmentContributionsThisMonth =
      allocation === null
        ? null
        : add(
            bucketSubtotal(allocation, 'InvestmentContribution'),
            bucketSubtotal(allocation, 'DividendReinvestment'),
          )

    // P22: o total investido no fim do mês ANTERIOR, lido do retrato — não
    // deduzido do total de hoje. `null` quando não há retrato daquele mês (numa
    // instalação nova), e aí o indicador mostra travessão em vez de um número
    // inventado.
    const retratos = await netWorthSnapshotReader.listByView(session.userId, query.view)
    const anterior = previousMonth(targetMonth)
    const priorInvestmentsTotal =
      retratos.find((retrato) => retrato.month === anterior)?.investmentsTotal ?? null

    const indicators = computeFinancialIndicators({
      month: targetMonth,
      view: query.view,
      statement,
      chart,
      balanceSheet,
      investments: patrimonio.investments,
      liabilities: patrimonio.liabilities,
      installments: [...patrimonio.installmentsByLiability.values()].flat(),
      investmentContributionsThisMonth,
      priorInvestmentsTotal,
    })
    return ok(indicators)
  },
})
