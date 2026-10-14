/**
 * The database connection — the only place a file on disk is opened.
 *
 * The SQLite file is DATA AT REST for this product: how much the person earns,
 * owes and where the money is (ADR-0009). Three consequences are implemented
 * here rather than described somewhere:
 *
 *   - It lives under `./.data/`, which is in `.gitignore`. Never inside `src/`
 *     and never inside `public/` — a database under `public/` is a public URL.
 *   - The directory is created 0700 and the file is chmod 0600 on every open, so
 *     no other account on the machine can read it. Set at every open, not only at
 *     creation: a file restored from a backup or copied by hand arrives 0644.
 *   - `foreign_keys = ON` per connection. SQLite defaults it OFF, which means
 *     every RESTRICT written in the schema is decoration until this line runs.
 */

import { chmodSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { schema } from './schema'

export const DEFAULT_DATABASE_PATH = './.data/bigorna.db'
const MIGRATIONS_FOLDER = 'drizzle'

/** Owner read/write only. */
const FILE_MODE = 0o600
/** Owner read/write/execute only. */
const DIRECTORY_MODE = 0o700

export type BigornaDatabase = ReturnType<typeof drizzle<typeof schema>>

function applyPragmas(connection: Database.Database, persistent: boolean): void {
  // Without this line every ON DELETE RESTRICT in schema.ts is inert: SQLite
  // ships foreign key enforcement OFF and it is per connection, not per file.
  connection.pragma('foreign_keys = ON')
  // A read must never fail because a write is in flight; the reports read a lot.
  connection.pragma('busy_timeout = 5000')
  if (persistent) {
    // WAL lets a report read while a Lançamento is being written.
    connection.pragma('journal_mode = WAL')
    connection.pragma('synchronous = NORMAL')
  }
}

/**
 * Opens (creating if needed) the database at `DATABASE_PATH`, applies the
 * pragmas, tightens the permissions and runs the pending migrations.
 */
export function openDatabase(path: string = process.env.DATABASE_PATH ?? DEFAULT_DATABASE_PATH): {
  db: BigornaDatabase
  connection: Database.Database
} {
  const absolute = resolve(path)
  const directory = dirname(absolute)
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true, mode: DIRECTORY_MODE })
  }
  chmodSync(directory, DIRECTORY_MODE)

  const connection = new Database(absolute)
  applyPragmas(connection, true)
  // After the open, because better-sqlite3 creates the file on open.
  chmodSync(absolute, FILE_MODE)
  // WAL adds two sidecar files that hold the same data as the database itself.
  for (const sidecar of [`${absolute}-wal`, `${absolute}-shm`]) {
    if (existsSync(sidecar)) chmodSync(sidecar, FILE_MODE)
  }

  const db = drizzle(connection, { schema })
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
  return { db, connection }
}

/**
 * A throwaway database for tests, with the SAME migrations applied.
 *
 * "The same migrations" is the whole point: a test schema built by hand drifts
 * from the real one, and the first thing to disappear in the drift is a CHECK
 * constraint — exactly the guard the tests are there to prove.
 */
export function createInMemoryDatabase(): { db: BigornaDatabase; connection: Database.Database } {
  const connection = new Database(':memory:')
  applyPragmas(connection, false)
  const db = drizzle(connection, { schema })
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
  return { db, connection }
}
