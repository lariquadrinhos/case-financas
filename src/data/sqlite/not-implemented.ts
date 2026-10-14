/**
 * A placeholder for a port whose SQLite adapter does not exist yet.
 *
 * `createSqliteRepositories` must return a value shaped like the WHOLE
 * `Repositories` registry (src/data/index.ts) even while most adapters are
 * still being built one context at a time. The header comment of this folder's
 * `index.ts` already commits to the shape this takes: the factory "throws —
 * loudly, with a code, at CALL time and not at import time." A stand-in that
 * answers `null`/`[]` for every method would be worse than that: a screen
 * reading an empty list from a port nobody wired up looks identical to a
 * screen reading a port that is correctly empty, and the difference is exactly
 * the kind of silent gap this comment exists to rule out.
 *
 * `unimplementedPort` is therefore a Proxy: it satisfies the port's TYPE at
 * compile time (so this file, and every other context's route, still
 * typechecks) and throws only if a caller actually invokes one of its methods.
 */

const UNIMPLEMENTED_CODE = 'data.sqlite_adapter_not_implemented'

/** Raised when a route or a test calls a port that has no adapter yet. */
export class SqliteAdapterNotImplementedError extends Error {
  constructor(port: string) {
    super(UNIMPLEMENTED_CODE)
    this.name = 'SqliteAdapterNotImplementedError'
    this.port = port
  }

  readonly port: string
}

/**
 * `port` is a plain label for the error, e.g. `"EntryReader"` — never logged
 * with anything sensitive, just the interface name (ADR-0009 §3).
 */
export function unimplementedPort<T extends object>(port: string): T {
  return new Proxy({} as T, {
    get(_target, property) {
      if (typeof property !== 'string') return undefined
      return () => {
        throw new SqliteAdapterNotImplementedError(`${port}.${property}`)
      }
    },
  })
}
