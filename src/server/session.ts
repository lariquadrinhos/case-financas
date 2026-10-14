import 'server-only'

import { ensureUserExists } from '@/data'

/**
 * Session and data-scoping seam — ADR-0008.
 *
 * The Figma has no login screen and PRD v6 assumed a local single-user install.
 * The decision for this phase is different: a private web app, with LGPD and
 * security as premises. To avoid paying for that across every screen in phase
 * 2, EVERY read and write of data already goes through here and already carries
 * a `userId`.
 *
 * What this seam guarantees today:
 *   - No repository query exists without a user scope.
 *   - Swapping the stub for a real provider (Auth.js) touches no screen.
 *
 * What it explicitly does NOT guarantee today:
 *   - There is no authentication. Anyone who can reach the URL sees the data.
 *     That is why this phase's environment is private and never exposed to the
 *     public internet.
 */

export type UserId = string & { readonly __brand: 'UserId' }

export interface Session {
  readonly userId: UserId
  /** Entities this session may read. Prepares multi-PJ (design note 158:2). */
  readonly allowedEntities: readonly ('PF' | 'PJ')[]
  /** `false` in this phase. Phase 2 swaps it for the provider's real answer. */
  readonly authenticated: boolean
}

const DEVELOPMENT_USER = 'development-user' as UserId

/**
 * The current request's session.
 *
 * Phase 1: always returns the local development session.
 * Phase 2: reads the session cookie and validates it. The signature does not change.
 *
 * `ensureUserExists` runs on every call: every other table's foreign key
 * anchors to this one row (`src/data/sqlite/schema.ts`'s `users` comment), and
 * outside of `src/data/fixtures/seed.ts`'s synthetic dev scenario nothing else
 * ever created it — measured directly: a genuinely fresh `.data/bigorna.db`
 * (migrations run, `make seed` never called) 500ed with
 * `SQLITE_CONSTRAINT_FOREIGNKEY` on the first write onboarding's own Plano de
 * Contas step made, which is exactly the screen whose entire job is to work on
 * a database with nothing in it yet. The insert is `onConflictDoNothing` on a
 * one-row primary key, so paying for it every request is cheaper than a cache
 * that has to be invalidated whenever a test swaps the database underneath it.
 */
export async function getSession(): Promise<Session> {
  await ensureUserExists(DEVELOPMENT_USER)
  return {
    userId: DEVELOPMENT_USER,
    allowedEntities: ['PF', 'PJ'],
    authenticated: false,
  }
}

/**
 * Same as `getSession`, but throws when there is no session. Use it in every
 * route that reads data — it makes explicit, today, where phase 2 will deny access.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session.userId) {
    throw new Error('session.missing')
  }
  return session
}
