'use client'

/**
 * "Hoje", read from the device — never from the server.
 *
 * `docs/ARCHITECTURE.md` §1 and every report route handler are explicit that
 * the domain and the API never read a clock: `month`/`asOf` are parameters the
 * CALLER supplies (`src/api/contracts/reports.ts`, header comments on
 * `balanceSheetQuerySchema` and `monthlyTrendQuerySchema`). A screen is the one
 * place allowed to ask "what day is it", the same way files_design/08 §8 has
 * the Home greeting read the device clock for "Bom dia/Boa tarde/Boa noite".
 *
 * Local calendar date, not UTC: `new Date().getUTCDate()` at 23:00 in
 * `America/Sao_Paulo` would already report tomorrow.
 */

import { type IsoDate, type Month, isoDate, month } from '@/domain/core'

export function todayIsoDate(): IsoDate {
  const now = new Date()
  const year = String(now.getFullYear()).padStart(4, '0')
  const monthPart = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return isoDate(`${year}-${monthPart}-${day}`)
}

export function todayMonth(): Month {
  return month(todayIsoDate().slice(0, 7))
}
