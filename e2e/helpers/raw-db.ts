/**
 * Direct SQLite access for the one thing HTTP cannot set up: a row that
 * belongs to a DIFFERENT user than the session the running app always
 * resolves to.
 *
 * `src/server/session.ts` has no login in this phase — `getSession()` always
 * answers `development-user` (ADR-0008) — so no HTTP request can ever create
 * data "as" another user to prove the 404-not-403 rule (ADR-0008 §3). The only
 * way to get a foreign-user row into the same database the running server
 * reads is to write it directly, exactly the way `src/data/sqlite/schema.test.ts`
 * proves a CHECK constraint: raw SQL against the same file, bypassing every
 * application layer on purpose.
 *
 * This intentionally does NOT import from `@/data` or `@/domain`: an e2e test
 * treats the running app as a black box, and the one exception (reaching past
 * HTTP into the database file) should touch as little of the app's own code
 * as possible, so a defect in this helper cannot masquerade as a passing test.
 */

import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import Database from 'better-sqlite3'

/** Same default as `src/data/sqlite/client.ts` — the file the running server opens. */
const DATABASE_PATH = process.env.DATABASE_PATH ?? './.data/bigorna.db'

/** Same id as `src/server/session.ts` `DEVELOPMENT_USER` — every request the running app answers resolves here. */
export const DEVELOPMENT_USER_ID = 'development-user'

export function openRawDb(): Database.Database {
  const db = new Database(resolve(DATABASE_PATH))
  db.pragma('foreign_keys = ON')
  return db
}

/**
 * Inserts a second user with one bank account, and returns its id. A bank
 * account is the cheapest row to plant: unlike an `Entry` it needs no
 * category, no chart of accounts, no seeded reference at all — just the user
 * row itself (`schema.ts`: `bank_accounts` foreign-keys only on `users`).
 */
export function seedForeignBankAccount(db: Database.Database): { readonly id: string } {
  // `randomUUID()`, not `Date.now()`: the two tests in user-scoping.spec.ts
  // run in separate Playwright workers in parallel and can call this within
  // the same millisecond — measured, as a `UNIQUE constraint failed: users.id`
  // on a run where both landed on the identical timestamp.
  const userId = `e2e-outro-usuario-${randomUUID()}`
  const accountId = `e2e-conta-${randomUUID()}`
  db.prepare(`insert into users (id, created_at) values (?, ?)`).run(userId, '2025-01-01')
  db.prepare(
    `insert into bank_accounts (user_id, id, label, colour, entity, balance)
     values (?, ?, ?, ?, ?, ?)`,
  ).run(userId, accountId, 'Conta de outra pessoa', 'nubank', 'PF', 0)
  return { id: accountId }
}

/**
 * Deletes every "instance" row the development user owns — bank accounts,
 * lançamentos, ocorrências, recorrências, ativos, passivos, parcelas — while
 * leaving `statement_blocks`/`categories` (the Plano de Contas the person set
 * up) untouched. This is the shape a real empty account actually has: someone
 * who never added a single conta, bem, investimento or lançamento, not a
 * database with no chart of accounts at all (a state the report endpoints do
 * not expect and no onboarding flow can produce).
 *
 * Table order mirrors `resetUserData` in `src/data/fixtures/seed.ts` exactly
 * (child before parent, respecting the `ON DELETE RESTRICT` foreign keys in
 * `schema.ts`), minus its last two statements.
 *
 * Raw SQL against the same file the running server has open — same rationale
 * as `seedForeignBankAccount` above: this is the one thing no HTTP endpoint
 * exists to do (there is no "delete everything" route, on purpose).
 */
export function wipeInstanceData(db: Database.Database, userId: string): void {
  const tablesInDeleteOrder = [
    'onboarding_progress',
    'discretionary_expenses',
    'allocation_items',
    'pending_allocations',
    'payment_discrepancies',
    'trace_events',
    'occurrences',
    'entries',
    'discretionary_spending_config',
    'profit_allocations',
    'recurrences',
    'rate_adjustments',
    'installments',
    'liabilities',
    'investments',
    'tangible_assets',
    'bank_accounts',
  ]
  const wipe = db.transaction(() => {
    for (const table of tablesInDeleteOrder) {
      db.prepare(`delete from ${table} where user_id = ?`).run(userId)
    }
  })
  wipe()
}

/**
 * Restores the development user to the standard seeded scenario by shelling
 * out to the project's own `npm run db:seed` (`scripts/seed.ts` →
 * `src/data/fixtures/seed.ts` `seed()`), the same idempotent reset every other
 * suite in this repo already relies on being available. Run from an e2e
 * `afterAll`/`finally` so a screen wiped for one empty-state assertion never
 * leaks into the next test file.
 */
export function reseedDevelopmentUser(): void {
  // No explicit `cwd`: Playwright always runs from the repo root (where
  // `playwright.config.ts` lives and `npm run test:e2e` is invoked), the same
  // place `npm run db:seed` expects to find `./.data/bigorna.db`.
  execFileSync('npm', ['run', 'db:seed'], { env: process.env, stdio: 'pipe' })
}
