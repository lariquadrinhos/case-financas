/**
 * Infrastructure e2e — ADR-0009 (LGPD e segurança). Against the real
 * production server (`playwright.config.ts` builds and starts it), never a
 * mock: a header set only in `next.config.ts`/`middleware.ts` and never
 * actually served would pass a unit test of those files and still fail here.
 */

import { expect, test } from '@playwright/test'
import { bankAccountSchema } from '@/api/contracts/bank-accounts'
import { listEnvelope } from '@/api/contracts/common'
import { incomeStatementSchema } from '@/api/contracts/reports'
import { pendingItemSchema } from '@/api/contracts/pending-items'

test.describe('ADR-0009 §2 — static security headers are on the actual response', () => {
  test('every response carries the fixed header set from next.config.ts', async ({ request }) => {
    const response = await request.get('/inicio')
    expect(response.headers()['x-content-type-options']).toBe('nosniff')
    expect(response.headers()['x-frame-options']).toBe('DENY')
    expect(response.headers()['referrer-policy']).toBe('no-referrer')
    expect(response.headers()['cross-origin-opener-policy']).toBe('same-origin')
    expect(response.headers()['cross-origin-resource-policy']).toBe('same-origin')
    expect(response.headers()['permissions-policy']).toContain('camera=()')
    // ADR-0009 never asks for a public product to run on http, but this phase
    // is dev/non-production — HSTS is conditional on NODE_ENV in the config.
    expect(response.headers()['x-powered-by']).toBeUndefined()
  })
})

test.describe('ADR-0009 §2 — the CSP nonce ties the header to the HTML of the SAME response', () => {
  test('the nonce in the Content-Security-Policy header matches the one on the inline script', async ({
    request,
  }) => {
    // ONE request, read twice (header + body) — the whole point of the test.
    // A nonce is generated fresh per request (`crypto.randomUUID()` in
    // src/middleware.ts), so comparing across two separate requests would
    // never catch a mismatch: two different valid nonces both "look right".
    const response = await request.get('/inicio')
    const csp = response.headers()['content-security-policy']
    expect(csp, 'CSP header must be present — set per-request in middleware.ts').toBeTruthy()

    const headerNonce = /'nonce-([^']+)'/.exec(csp ?? '')?.[1]
    expect(headerNonce, 'CSP must carry a script-src nonce').toBeTruthy()

    const html = await response.text()
    const scriptNonce = /<script nonce="([^"]+)"/.exec(html)?.[1]
    expect(scriptNonce, 'the theme bootstrap script must carry the SAME nonce').toBeTruthy()

    expect(scriptNonce).toBe(headerNonce)
  })

  test('two different requests get two different nonces (it is per-request, not a constant)', async ({
    request,
  }) => {
    const first = await request.get('/inicio')
    const second = await request.get('/inicio')
    const nonceOf = (csp: string | undefined) => /'nonce-([^']+)'/.exec(csp ?? '')?.[1]
    const a = nonceOf(first.headers()['content-security-policy'])
    const b = nonceOf(second.headers()['content-security-policy'])
    expect(a).toBeTruthy()
    expect(b).toBeTruthy()
    expect(a).not.toBe(b)
  })
})

test.describe('ADR-0009 §5 — no third-party origin, ever', () => {
  test('loading a page issues no request to any origin but our own', async ({ page, baseURL }) => {
    const foreignRequests: string[] = []
    page.on('request', (req) => {
      const url = new URL(req.url())
      if (url.origin !== new URL(baseURL ?? 'http://localhost:3000').origin) {
        foreignRequests.push(req.url())
      }
    })

    await page.goto('/inicio', { waitUntil: 'load' })
    // Not `networkidle`: under the parallel e2e run, the single dev/production
    // server is busy serving every OTHER spec's API calls too, and Chromium's
    // idle detector can stall past the default timeout for reasons that have
    // nothing to do with THIS page issuing a request — a fixed short wait is
    // the honest way to give the static `/inicio` page's own requests (there
    // are none beyond the document itself) a chance to happen, without betting
    // the test on unrelated traffic quieting down first.
    await page.waitForTimeout(1000)

    expect(foreignRequests).toEqual([])
  })
})

test.describe('RFC 9457 — errors are application/problem+json, and never leak internals', () => {
  test('a missing required query param answers 422 problem+json, not a stack trace', async ({
    request,
  }) => {
    const response = await request.get(
      '/api/v1/reports/income-statement?month=2026-07&view=Consolidated',
    )
    expect(response.status()).toBe(422)
    expect(response.headers()['content-type']).toContain('application/problem+json')
    const body = (await response.json()) as Record<string, unknown>
    expect(body.type).toMatch(/^urn:bigorna:problem:/)
    expect(typeof body.detail).toBe('string')
    const raw = JSON.stringify(body)
    // ADR-0009 §3: no stack trace, no SQL, no filesystem path in a body a
    // person copies into a ticket.
    expect(raw).not.toMatch(/\/Users\/|\.ts:\d|SQLITE_|at Object\.|node_modules/)
  })

  test('an id that does not exist for this user answers 404 problem+json, never 403', async ({
    request,
  }) => {
    const response = await request.get('/api/v1/bank-accounts/this-id-does-not-exist')
    expect(response.status()).toBe(404)
    expect(response.headers()['content-type']).toContain('application/problem+json')
    const body = (await response.json()) as Record<string, unknown>
    expect(body.code).toBe('resource.not_found')
  })

  test('a malformed JSON body answers 400, distinct from a semantically invalid one (422)', async ({
    request,
  }) => {
    const response = await request.post('/api/v1/bank-accounts', {
      headers: { 'content-type': 'application/json' },
      // A plain string in Playwright's `data` still gets treated as something
      // to encode in some versions — a `Buffer` is the one shape guaranteed to
      // travel byte-for-byte, which is the whole point: this has to be bytes
      // `request.json()` fails to parse, not a valid JSON string the schema
      // then rejects for its shape (that would be 422, the other branch this
      // test exists to tell apart from 400).
      data: Buffer.from('{not json', 'utf-8'),
    })
    expect(response.status()).toBe(400)
    expect(response.headers()['content-type']).toContain('application/problem+json')
  })
})

test.describe('every GET response validates against the Zod contract schema', () => {
  test('GET /api/v1/bank-accounts matches listEnvelope(bankAccountSchema)', async ({ request }) => {
    const response = await request.get('/api/v1/bank-accounts')
    expect(response.status()).toBe(200)
    const body: unknown = await response.json()
    expect(() => listEnvelope(bankAccountSchema).parse(body)).not.toThrow()
  })

  test('GET /api/v1/reports/income-statement (seed month) matches incomeStatementSchema', async ({
    request,
  }) => {
    const response = await request.get(
      '/api/v1/reports/income-statement?month=2026-07&view=Consolidated&statusFilter=Paid',
    )
    expect(response.status()).toBe(200)
    const body: unknown = await response.json()
    expect(() => incomeStatementSchema.parse(body)).not.toThrow()
  })

  test('GET /api/v1/pending-items (seed data has all 4 kinds) matches listEnvelope(pendingItemSchema)', async ({
    request,
  }) => {
    const response = await request.get('/api/v1/pending-items')
    expect(response.status()).toBe(200)
    const body: unknown = await response.json()
    expect(() => listEnvelope(pendingItemSchema).parse(body)).not.toThrow()
  })
})
