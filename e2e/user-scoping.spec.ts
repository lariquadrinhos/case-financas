/**
 * ADR-0008 §3 — asking for another user's resource answers 404, never 403.
 *
 * There is no login in this phase (`src/server/session.ts`): every request the
 * running server receives resolves to the same `development-user` session. No
 * HTTP call can therefore ever create data "as" a second user — the only way
 * to prove the scoping rule end-to-end is to plant a foreign-user row directly
 * in the database file the server already has open (see
 * `e2e/helpers/raw-db.ts`), then ask the RUNNING SERVER for it by id over real
 * HTTP, exactly the way a leaked id (a bookmarked URL, a shared link) would.
 *
 * Answering 403 here would itself be the leak ADR-0008 §3 calls out: it tells
 * the caller the id exists, just not for them. 404 says nothing.
 */

import { expect, test } from '@playwright/test'
import { openRawDb, seedForeignBankAccount } from './helpers/raw-db'

test.describe('ADR-0008 §3 — a foreign user’s resource is invisible, not forbidden', () => {
  test('GET /api/v1/bank-accounts/{id} on another user’s row answers 404, not 403', async ({
    request,
  }) => {
    const db = openRawDb()
    let foreignAccountId: string
    try {
      foreignAccountId = seedForeignBankAccount(db).id
    } finally {
      db.close()
    }

    const response = await request.get(`/api/v1/bank-accounts/${foreignAccountId}`)

    expect(response.status()).toBe(404)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.code).toBe('resource.not_found')
    // The 404 detail must not, itself, confirm the row exists for someone else.
    expect(JSON.stringify(body)).not.toMatch(/outra pessoa|e2e-outro-usuario/)
  })

  test('PATCH on another user’s row also answers 404 — a write path leaks the same way a read does', async ({
    request,
  }) => {
    const db = openRawDb()
    let foreignAccountId: string
    try {
      foreignAccountId = seedForeignBankAccount(db).id
    } finally {
      db.close()
    }

    const response = await request.patch(`/api/v1/bank-accounts/${foreignAccountId}`, {
      data: { label: 'Tentativa de sequestro' },
    })

    expect(response.status()).toBe(404)
  })
})
