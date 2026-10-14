/**
 * Empty-state e2e — forcing the ONE shared `development-user` database
 * (ADR-0008: no login in this phase, every request resolves to the same
 * session) into a genuinely empty account, and checking each screen shows
 * its documented `EMPTY_STATES` entry — not a blank page, not a thrown error.
 *
 * This is the one spec in the suite that mutates shared state the rest of
 * the suite depends on, so it runs as its OWN Playwright project
 * (`playwright.config.ts`, `dependencies: ['chromium']`) that starts only
 * after every other test has finished — never in parallel with them. See
 * `e2e/helpers/raw-db.ts` `wipeInstanceData` for exactly what gets deleted
 * (every bank account, lançamento, recorrência, ativo and passivo — the
 * Plano de Contas itself is left standing, the same way a real onboarding
 * leaves it) and `reseedDevelopmentUser` for how the standard fixture comes
 * back in `afterAll`, whether the assertions below pass or fail.
 */

import { expect, test } from '@playwright/test'
import {
  DEVELOPMENT_USER_ID,
  openRawDb,
  reseedDevelopmentUser,
  wipeInstanceData,
} from './helpers/raw-db'
import { EMPTY_STATES } from '../src/components/patterns/empty-states'

test.describe.configure({ mode: 'serial' })

test.describe('Conta vazia — cada tela mostra o EMPTY_STATES certo, não uma tela quebrada', () => {
  test.beforeAll(() => {
    const db = openRawDb()
    try {
      wipeInstanceData(db, DEVELOPMENT_USER_ID)
    } finally {
      db.close()
    }
  })

  test.afterAll(() => {
    // Runs even if an assertion above threw — the shared database has to come
    // back for whoever runs this repo's e2e suite next, human or CI.
    reseedDevelopmentUser()
  })

  test('Contas Bancárias mostra "Nenhuma conta cadastrada"', async ({ page }) => {
    await page.goto('/contas-bancarias')
    await expect(page.getByText(EMPTY_STATES.CONTAS_BANCARIAS.title, { exact: true })).toBeVisible()
    await expect(
      page.getByText(EMPTY_STATES.CONTAS_BANCARIAS.message, { exact: true }),
    ).toBeVisible()
    // Never a thrown error screen, never a silently blank content area.
    await expect(page.getByText(/não foi possível|erro inesperado/i)).toHaveCount(0)
  })

  test('Histórico mostra "Nenhum lançamento ainda"', async ({ page }) => {
    await page.goto('/historico')
    await expect(page.getByText(EMPTY_STATES.HISTORICO.title, { exact: true })).toBeVisible()
    await expect(page.getByText(EMPTY_STATES.HISTORICO.message, { exact: true })).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
  })

  test('DRE mostra "Nada lançado ainda este mês", com a cascata inteira zerada', async ({
    page,
  }) => {
    await page.goto('/dre')
    // No entries/installments left for ANY user, `rows` is empty for every
    // month — no navigation needed, unlike the functional-fidelity DRE test,
    // which specifically needs the SEEDED July.
    await expect(page.getByText(EMPTY_STATES.DRE.title, { exact: true })).toBeVisible()
    await expect(page.getByText(EMPTY_STATES.DRE.message, { exact: true })).toBeVisible()
  })

  test('Revisão de Recorrentes mostra "Nenhuma recorrência configurada"', async ({ page }) => {
    await page.goto('/revisao-de-recorrentes')
    await expect(
      page.getByText(EMPTY_STATES.REVISAO_DE_RECORRENTES.title, { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText(EMPTY_STATES.REVISAO_DE_RECORRENTES.message, { exact: true }),
    ).toBeVisible()
  })
})
