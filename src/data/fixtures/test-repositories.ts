/**
 * A `Repositories` registry backed by a throwaway in-memory SQLite database,
 * for route-handler integration tests (any context, not only chart-of-accounts).
 *
 * It exists here, in `src/data/`, and not beside the route tests in `src/app/`,
 * because `eslint.config.mjs` forbids `src/app/**` from importing
 * `@/data/sqlite` directly — a route depends on the PORT, never the adapter
 * (docs/ARCHITECTURE.md §3). This file is allowed to reach for the real
 * adapter because it lives on the data side of that boundary; a route test
 * then imports ONLY this function, never `@/data/sqlite` itself.
 *
 * It reuses `createSqliteRepositories` rather than re-listing every port, so a
 * test exercises the exact same wiring production does: real chart-of-accounts
 * adapters, `unimplementedPort` stand-ins for everything not built yet.
 */

import type Database from 'better-sqlite3'
import { createSqliteRepositories } from '@/data/sqlite'
import { withNetWorthRecording } from '@/data/net-worth-recording'
import { todayIsoDate } from '@/lib/clock'
import { createInMemoryDatabase, type BigornaDatabase } from '@/data/sqlite/client'
import type { Repositories, UserId } from '@/data'
import type { IsoDate } from '@/domain/core'
import { setRepositories } from '@/data'

export interface TestRepositories {
  readonly repositories: Repositories
  /**
   * The raw connection backing `repositories`. Exposed (not just kept for
   * `teardown`) so `useTestRepositories` can bind it alongside the
   * repositories — a route under test that calls `withTransaction`
   * (ADR-0014) needs a real connection to `BEGIN IMMEDIATE` against, or it
   * throws `transaction.unavailable` instead of exercising the seam the test
   * exists to cover.
   */
  readonly connection: Database.Database
  /**
   * The Drizzle handle backing `repositories`. Exposed for the same reason as
   * `connection`: a test that rebinds a partial `Repositories` via
   * `setRepositories` (e.g. to fake ONE port) must pass this along too, or
   * `getSession()`'s `ensureUserExists` throws `database.unavailable` on the
   * very next request.
   */
  readonly db: BigornaDatabase
  /** Closes the in-memory database. Call it in `afterEach`. */
  teardown(): void
}

/**
 * `session.userId` under `src/server/session.ts` in this phase — there is no
 * login, so every route test runs as this same id (ADR-0008 §1).
 */
export const TEST_USER_ID = 'development-user' as UserId

/**
 * `today` existe para o teste PODER fixar a data: o retrato mensal do PL (P21) é
 * carimbado com ela, e um teste que dependesse do relógio da máquina só falharia
 * na virada do mês.
 */
export function createTestRepositories(today: () => IsoDate = todayIsoDate): TestRepositories {
  const { db, connection } = createInMemoryDatabase()
  // Every table's foreign key ultimately anchors to `users` (schema.ts).
  // Production creates this row lazily, from `getSession()`
  // (`@/data`'s `ensureUserExists`) — a route test that goes through the real
  // `handler()` would get it for free too, but inserting it directly here
  // keeps this fixture usable by tests that call a repository straight,
  // bypassing `getSession()` entirely.
  connection
    .prepare('insert into users (id, created_at) values (?, ?)')
    .run(TEST_USER_ID, '2026-01-01')
  return {
    // Decorado do mesmo jeito que `@/data` decora em produção. Sem isto o
    // harness divergiria do que roda de verdade, e o retrato do PL — que é
    // gravado pelo decorador — não teria teste nenhum.
    repositories: withNetWorthRecording(createSqliteRepositories(db), today),
    connection,
    db,
    teardown: () => connection.close(),
  }
}

/**
 * Binds a fresh in-memory-backed registry for the duration of one test file and
 * hands back the teardown a caller's `afterEach` needs to run.
 */
export function useTestRepositories(today?: () => IsoDate): TestRepositories {
  const handle = createTestRepositories(today)
  setRepositories(handle.repositories, handle.connection, handle.db)
  return handle
}
