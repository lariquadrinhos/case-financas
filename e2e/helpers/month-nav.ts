/**
 * Drives `@/components/patterns/month-nav.tsx` ("← Mês Ano →") to a specific
 * target month, from whatever month the screen opened on.
 *
 * Every report screen resolves its OWN starting month from the device clock
 * (`@/lib/today.ts` `todayMonth()`, read once after mount — see the DRE and
 * Revisão de Recorrentes screens) rather than from a URL param, so an e2e test
 * that needs a SPECIFIC month (the seed month, or one guaranteed to carry no
 * data) cannot just visit a URL — it has to click the same "Mês anterior" /
 * "Próximo mês" buttons a person would, however many times "today" is away
 * from the target. Computing that offset at run time (instead of hard-coding
 * a click count) is what keeps this working on every day this suite ever
 * runs, not only the day it was written.
 */

import type { Page } from '@playwright/test'

/**
 * Clicks the MonthNav's `←`/`→` button enough times to land on
 * `targetYear`-`targetMonth` (1-indexed, like a calendar month), assuming the
 * page already rendered its month nav at the device's current month.
 */
export async function navigateMonthNavTo(
  page: Page,
  targetYear: number,
  targetMonth: number,
): Promise<void> {
  const now = new Date()
  const diff = (targetYear - now.getFullYear()) * 12 + (targetMonth - 1 - now.getMonth())
  if (diff === 0) return
  const button = page.getByRole('button', { name: diff < 0 ? 'Mês anterior' : 'Próximo mês' })
  for (let i = 0; i < Math.abs(diff); i++) {
    await button.click()
  }
}

/**
 * True when the device's current month is one of the months
 * `src/data/fixtures/seed.ts` actually put Lançamentos in (2026-05/06/07) —
 * the one window where "today" would accidentally carry real seeded revenue
 * instead of the empty base a zero-denominator assertion needs. Guards a test
 * that means to read "no data this month" from `todayMonth()` directly,
 * without navigating anywhere.
 */
export function todayFallsInsideSeedWindow(): boolean {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1-indexed
  return year === 2026 && month >= 5 && month <= 7
}
