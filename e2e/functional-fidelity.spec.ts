/**
 * Functional-fidelity e2e — against the REAL production server and the
 * seeded database, same rationale as `prd-fidelity.spec.ts`: a screen that
 * answers 200 and shows a number is not the same as a screen that shows the
 * RIGHT number, or that a toggle actually toggles anything.
 */

import { expect, test } from '@playwright/test'
import { navigateMonthNavTo, todayFallsInsideSeedWindow } from './helpers/month-nav'

/* -------------------------------------------------------------------------
 * Tema — o alternador muda `data-theme` e sobrevive a um reload.
 * ---------------------------------------------------------------------- */

test.describe('Alternador de tema — muda data-theme e persiste depois de recarregar', () => {
  test('escolher "Tema escuro" marca <html data-theme="dark"> e continua marcado após F5', async ({
    page,
  }) => {
    await page.goto('/inicio')

    // No estado inicial ("system"), nenhum atributo é escrito — só uma escolha
    // explícita grava `data-theme` (theme-toggle.tsx `applyTheme`).
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)

    await page.getByRole('button', { name: 'Tema escuro' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    await page.reload()
    // O bootstrap inline (`THEME_BOOTSTRAP`, injetado com nonce da CSP em
    // `layout.tsx`) tem que aplicar o tema ANTES da pintura — não depois da
    // hidratação do React — ou a página piscaria clara e trocaria depois.
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    // E volta pro claro do mesmo jeito.
    await page.getByRole('button', { name: 'Tema claro' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  })
})

/* -------------------------------------------------------------------------
 * Novo Lançamento → Histórico — um lançamento criado no formulário aparece
 * no Histórico com o valor formatado certo.
 * ---------------------------------------------------------------------- */

test.describe('Novo Lançamento → Histórico — o lançamento criado aparece com o valor certo', () => {
  test('uma Despesa de R$ 543,21 em Alimentação aparece no Histórico como −R$ 543,21', async ({
    page,
  }) => {
    await page.goto('/novo-lancamento?from=historico')
    // Novo Lançamento é o diálogo `872:1305` / `6:29` — o título `872:1306`
    // é o nome acessível do próprio contêiner, não um `h1` de rota.
    await expect(page.getByRole('dialog', { name: 'Novo Lançamento' })).toBeVisible()

    // MoneyInput (src/components/patterns/money-input.tsx): the digits typed
    // ARE the cents, right-aligned under the mask — "54321" is R$ 543,21.
    await page.getByLabel('Valor').fill('54321')

    // Categoria — busca/cria inline (CategoryField), "Alimentação" is one of
    // `DEFAULT_CATEGORIES` every seeded user always has
    // (src/domain/chart-of-accounts/types.ts).
    await page.getByLabel('Categoria').fill('Alimentação')
    await page.getByRole('button', { name: 'Alimentação', exact: true }).click()

    // Conta — Nubank is the PF account `seed.ts` always creates.
    await page.getByLabel('Conta').click()
    await page.getByRole('option', { name: 'Nubank' }).click()

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/v1/entries') && res.request().method() === 'POST',
      ),
      page.getByRole('button', { name: 'Salvar Lançamento' }).click(),
    ])
    expect(response.status()).toBe(201)
    const created = (await response.json()) as { id: string }

    // 2026-09-29: "Salvar Lançamento" salva e FECHA, voltando à origem — a tela
    // intermediária "Lançamento salvo com sucesso / Voltar" saiu.
    await expect(page).toHaveURL(/\/historico$/)

    try {
      // The seed only ever writes Lançamentos into 2026-05/06/07
      // (`src/data/fixtures/seed.ts` `ALL_SEEDED_MONTHS`) — filtering
      // Histórico to THIS month isolates the one entry this test just made,
      // with no dependency on table sort order or the 500-row page size.
      const now = new Date()
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      await page.getByLabel('Mês', { exact: true }).fill(thisMonth)

      const row = page.getByRole('row', { name: /Alimentação/ })
      await expect(row).toBeVisible()
      // `formatSignedMoney` (entry-display.ts): a Despesa always prints the
      // typographic minus, never a bare "-" or a bracketed amount.
      await expect(row).toContainText(/[−-]\s*R\$\s*543,21/)
    } finally {
      await page.request.delete(`/api/v1/entries/${created.id}`)
    }
  })
})

/* -------------------------------------------------------------------------
 * DRE — os controles Consolidado/PF/PJ e Pago/Previsto realmente mudam o
 * número mostrado (não só o rótulo do controle).
 * ---------------------------------------------------------------------- */

test.describe('DRE — trocar Consolidado/PF/PJ e Pago/Previsto muda o número mostrado', () => {
  test('PF mostra a Receita Bruta de julho/2026 (R$ 24.400,00); Previsto some com a cascata do mês', async ({
    page,
  }) => {
    await page.goto('/dre')
    await navigateMonthNavTo(page, 2026, 7)
    await expect(page.getByText('Julho 2026', { exact: true })).toBeVisible()

    const cascadeTable = page.locator('table').filter({ has: page.locator('caption') })
    const receitaBrutaCell = cascadeTable
      .locator('tr', { hasText: 'Receita Bruta' })
      .locator('td')
      .last()

    const consolidatedAmount = (await receitaBrutaCell.innerText()).trim()

    await page.getByRole('radiogroup', { name: 'Visão' }).getByRole('radio', { name: 'PF' }).click()
    await expect(receitaBrutaCell).toContainText('24.400,00')
    const pfAmount = (await receitaBrutaCell.innerText()).trim()
    expect(pfAmount).not.toBe(consolidatedAmount)

    // PJ's own "Despesas Administrativas" carries the pró-labore expense
    // (prd-fidelity.spec.ts already proves this at the API level: R$
    // 4.000,00) — the UI toggle has to reach the SAME number.
    await page.getByRole('radiogroup', { name: 'Visão' }).getByRole('radio', { name: 'PJ' }).click()
    await expect(
      cascadeTable.locator('tr', { hasText: 'Despesas Administrativas' }).locator('td').last(),
    ).toContainText('4.000,00')

    // Back to Consolidado, then Previsto: julho/2026 has no Lançamento
    // Previsto in the seed (prd-fidelity.spec.ts, same fact), so the CASCADE
    // (every line, `Receita Bruta` included) goes to zero — this is a
    // separate scope from "Lançamentos deste mês" below the cascade, which
    // always lists every lançamento of the month regardless of the toggle
    // (each row carries its OWN Pago/Previsto badge, `dre/page.tsx`
    // `EntryRowActions`) and is therefore never empty just because Previsto
    // has nothing of its own — the DRE empty state only fires when the month
    // has no lançamento AT ALL (`empty-state.spec.ts` proves that case).
    await page
      .getByRole('radiogroup', { name: 'Visão' })
      .getByRole('radio', { name: 'Consolidado' })
      .click()
    // Back to the exact same figure the test started with, still under Pago.
    await expect(receitaBrutaCell).toHaveText(consolidatedAmount)
    await page
      .getByRole('radiogroup', { name: 'Status' })
      .getByRole('radio', { name: 'Previsto' })
      .click()
    await expect(receitaBrutaCell).toContainText('R$ 0,00')
  })
})

/* -------------------------------------------------------------------------
 * Indicadores Financeiros — um indicador com denominador zero mostra
 * travessão, nunca NaN/0/campo quebrado.
 * ---------------------------------------------------------------------- */

test.describe('Indicadores Financeiros — denominador zero mostra "—", nunca NaN/0', () => {
  test('num mês sem nenhuma Receita, Margem bruta mostra "—" ao lado do rótulo', async ({
    page,
  }) => {
    await page.goto('/indicadores-financeiros')

    // `todayMonth()` drives this screen's starting month with no URL param
    // (files_design/08 §10) — the seed only ever wrote Receita/Despesa
    // Lançamentos into 2026-05/06/07, so any OTHER month already has zero
    // revenue. The guard below only matters if this suite is ever run during
    // that exact 3-month window; every other day it is a no-op.
    if (todayFallsInsideSeedWindow()) {
      await navigateMonthNavTo(page, 2031, 1)
    }

    // The label and its value are sibling `<span>`s under one row div
    // (`IndicatorFamilyCard` in indicadores-financeiros/page.tsx) — walking to
    // the very next sibling is exact, unlike scanning ancestor containers for
    // ones that merely happen to include this text somewhere inside them.
    const label = page.getByText('Margem bruta', { exact: true })
    await expect(label).toBeVisible()
    const value = label.locator('xpath=following-sibling::span[1]')
    const text = (await value.innerText()).trim()
    expect(text).toBe('—')
    expect(text).not.toMatch(/NaN/i)
    expect(text).not.toBe('0')
    expect(text).not.toBe('0%')
  })
})

/* -------------------------------------------------------------------------
 * Sem requisição de terceiro nas telas novas (mesma checagem de
 * infra.spec.ts, agora cobrindo as telas de produto).
 * ---------------------------------------------------------------------- */

const NEW_SCREENS = [
  '/inicio',
  '/novo-lancamento',
  '/dre',
  '/historico',
  '/revisao-de-recorrentes',
  '/onboarding',
] as const

test.describe('ADR-0009 §5 — nenhuma origem de terceiro nas telas de produto', () => {
  for (const path of NEW_SCREENS) {
    test(`${path} não dispara nenhuma requisição pra fora da própria origem`, async ({
      page,
      baseURL,
    }) => {
      const foreignRequests: string[] = []
      page.on('request', (req) => {
        const url = new URL(req.url())
        if (url.origin !== new URL(baseURL ?? 'http://localhost:3000').origin) {
          foreignRequests.push(req.url())
        }
      })

      await page.goto(path, { waitUntil: 'load' })
      // Fixed short wait, not `networkidle` — same rationale as
      // infra.spec.ts: this suite's OTHER specs share the one server and keep
      // it busy, which stalls Chromium's idle detector for reasons that have
      // nothing to do with whether THIS page issues a foreign request.
      await page.waitForTimeout(1000)

      expect(foreignRequests).toEqual([])
    })
  }
})

/* -------------------------------------------------------------------------
 * Cabeçalhos de segurança nas rotas novas — mesmo par de provas de
 * infra.spec.ts (headers fixos + nonce da CSP casando com o HTML), agora nas
 * rotas de tela em vez de só `/inicio`.
 * ---------------------------------------------------------------------- */

test.describe('ADR-0009 §2 — cabeçalhos de segurança e nonce da CSP nas rotas novas', () => {
  for (const path of NEW_SCREENS) {
    test(`${path} carrega os headers fixos e um nonce que bate com o HTML`, async ({ request }) => {
      const response = await request.get(path)
      expect(response.headers()['x-content-type-options']).toBe('nosniff')
      expect(response.headers()['x-frame-options']).toBe('DENY')
      expect(response.headers()['content-security-policy']).toBeTruthy()

      const csp = response.headers()['content-security-policy'] ?? ''
      const headerNonce = /'nonce-([^']+)'/.exec(csp)?.[1]
      expect(headerNonce, `${path}: CSP must carry a script-src nonce`).toBeTruthy()

      const html = await response.text()
      const scriptNonce = /<script nonce="([^"]+)"/.exec(html)?.[1]
      expect(scriptNonce, `${path}: theme bootstrap script must carry a nonce`).toBeTruthy()
      expect(scriptNonce).toBe(headerNonce)
    })
  }
})
