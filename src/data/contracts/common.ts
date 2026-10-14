/**
 * What every repository port shares.
 *
 * Three rules hold for every interface in this folder, and none of them is
 * negotiable per adapter:
 *
 * 1. **`userId` is the first parameter of every method** (ADR-0008 §3). Not
 *    because it filters something useful today — there is one user — but because
 *    there is then no signature left to change in phase 2. A query without a
 *    user scope is a compile error, not an audit finding.
 * 2. **Ports speak DOMAIN types.** `Entry`, `Cents`, `IsoDate`. Never a Drizzle
 *    row, never a `Record<string, unknown>`. The mapping from row to aggregate is
 *    the adapter's job, and it is the only thing that changes when the database
 *    does.
 * 3. **Reader and Writer are separate** (SOLID/ISP). A screen that only lists
 *    Lançamentos depends on `EntryReader` and cannot delete one by accident, and
 *    a test double for it has three methods to implement instead of nine.
 *
 * Ids are assigned by the WRITER, not by the caller: `create` takes a `New*`
 * value and returns the stored aggregate. The domain is pure and may not invent
 * an id (src/domain/README.md), so the edge stamps it.
 */

import type { UserId } from '@/server/session'

export type { UserId }

/** A window over a list. Absent means "everything", which is what most screens want. */
export interface Page {
  readonly limit: number
  readonly offset: number
}

/**
 * A list plus the count BEFORE the window, so a caller can page without a second
 * round trip — and so the HTTP envelope `{ data, meta: { total } }` has a `total`
 * that means something.
 */
export interface PagedResult<T> {
  readonly items: readonly T[]
  readonly total: number
}

/**
 * The two halves every aggregate port is made of, spelled out once so that
 * "reader" and "writer" mean the same thing in eleven files.
 *
 * A port is free to add methods (`EntryReader.listByMonth`), and several do —
 * but none of them may DROP one, because the contract test suite runs against
 * this shape for every adapter (SOLID/LSP).
 */
export interface Reader<T, Id> {
  /** `null`, never a throw: absence is an answer, and the handler turns it into a 404. */
  findById(userId: UserId, id: Id): Promise<T | null>
  list(userId: UserId, page?: Page): Promise<readonly T[]>
  count(userId: UserId): Promise<number>
}

export interface Writer<T, New, Id> {
  create(userId: UserId, value: New): Promise<T>
  /**
   * Replaces the whole aggregate. Not a partial patch: the domain computes the
   * new state from the old one and the repository stores what it is given. A
   * repository that merges fields is a repository holding a business rule.
   */
  replace(userId: UserId, value: T): Promise<T>
  /** Removing something that is not there is not an error — the end state is the same. */
  remove(userId: UserId, id: Id): Promise<void>
}
