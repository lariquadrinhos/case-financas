/**
 * Recognising a SQLite foreign-key violation, in one place.
 *
 * `schema.ts` puts `RESTRICT` on every foreign key on purpose (ADR-0012 §2): a
 * Conta Bancária, um Bem Material, um Investimento or um Passivo still
 * referenced by a lançamento, uma recorrência ou uma parcela must refuse to be
 * deleted, loudly. better-sqlite3 raises that refusal as a driver-level
 * `SqliteError` — a shape no route or repository should have to know about
 * more than once. Each repository's `remove()` catches it here and rethrows
 * the aggregate's own `<resource>.in_use` code, which `src/api/http.ts` maps
 * to 409.
 *
 * The `code` SQLite reports for the SAME kind of violation is not stable: a
 * single-column FK answers `SQLITE_CONSTRAINT_FOREIGNKEY`, but the composite
 * `(user_id, x_id)` foreign keys this schema uses (ADR-0012 §2 — "chaves
 * estrangeiras compostas") answer `SQLITE_CONSTRAINT_TRIGGER` instead for the
 * identical "still referenced" situation — measured directly against
 * better-sqlite3, not assumed from the docs. The message text is the part
 * that stays constant across both, so both the code family and the message
 * are checked.
 */

interface SqliteErrorShape {
  readonly code?: unknown
  readonly message?: unknown
}

function hasSqliteErrorShape(error: unknown): error is SqliteErrorShape {
  return typeof error === 'object' && error !== null && 'code' in error
}

export function isForeignKeyViolation(error: unknown): boolean {
  if (!hasSqliteErrorShape(error)) return false
  const { code, message } = error
  return (
    typeof code === 'string' &&
    code.startsWith('SQLITE_CONSTRAINT') &&
    typeof message === 'string' &&
    message.includes('FOREIGN KEY')
  )
}
