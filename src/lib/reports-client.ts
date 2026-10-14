'use client'

/**
 * Client-side access to `/api/v1/reports/*` — the four screens of this group
 * (DRE, Balanço Patrimonial, Evolução Mensal, Indicadores Financeiros) never
 * invent a parallel read model: they call the SAME routes `src/app/api/v1/
 * reports/**` exposes, over the SAME `apiGet` every other screen uses
 * (`@/lib/api-client`), and parse the response with the SAME Zod schema the
 * route itself is typed against (`src/api/contracts/reports.ts`). A screen
 * that only cast `as IncomeStatement` on the raw `fetch` result would silently
 * accept a shape drift the backend never signed up for; parsing at the
 * boundary is what makes this a real contract instead of a shared type
 * comment.
 *
 * The cast to the richer domain type below (`@/domain/reports`) is a DIFFERENT
 * thing, applied only AFTER that parse succeeds: the wire schema's `Cents`/
 * `Month`/`View` fields are plain `number`/`string` (JSON has no brand), while
 * the domain type brands them (`type Cents = number & {brand}`). The brand is
 * erased at runtime — `Cents` IS a `number` on the wire — so once Zod has
 * verified the shape and every constraint (`int()`, the date/month regex, the
 * enum), asserting the branded type is a compile-time-only step, not a second,
 * unverified guess at the shape.
 */

import type { z } from 'zod'
import { apiGet } from '@/lib/api-client'
import {
  balanceSheetSchema,
  financialIndicatorsSchema,
  incomeStatementSchema,
  monthlyTrendSchema,
  type balanceSheetQuerySchema,
  type financialIndicatorsQuerySchema,
  type incomeStatementQuerySchema,
  type monthlyTrendQuerySchema,
} from '@/api/contracts/reports'
import type {
  BalanceSheet,
  FinancialIndicators,
  IncomeStatement,
  MonthlyTrend,
} from '@/domain/reports'

async function getReport<Domain, Schema extends z.ZodType>(
  path: string,
  query: Record<string, string | undefined>,
  schema: Schema,
): Promise<Domain> {
  const payload = await apiGet<unknown>(path, query)
  return schema.parse(payload) as unknown as Domain
}

export function fetchIncomeStatement(query: z.input<typeof incomeStatementQuerySchema>) {
  return getReport<IncomeStatement, typeof incomeStatementSchema>(
    '/reports/income-statement',
    query,
    incomeStatementSchema,
  )
}

export function fetchBalanceSheet(query: z.input<typeof balanceSheetQuerySchema>) {
  return getReport<BalanceSheet, typeof balanceSheetSchema>(
    '/reports/balance-sheet',
    query,
    balanceSheetSchema,
  )
}

export function fetchMonthlyTrend(query: z.input<typeof monthlyTrendQuerySchema>) {
  return getReport<MonthlyTrend, typeof monthlyTrendSchema>(
    '/reports/monthly-trend',
    query,
    monthlyTrendSchema,
  )
}

export function fetchFinancialIndicators(query: z.input<typeof financialIndicatorsQuerySchema>) {
  return getReport<FinancialIndicators, typeof financialIndicatorsSchema>(
    '/reports/indicators',
    query,
    financialIndicatorsSchema,
  )
}
