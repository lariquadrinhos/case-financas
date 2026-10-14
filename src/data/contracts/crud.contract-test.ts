/**
 * The contract suite every aggregate repository must pass, written against the
 * PORT and not against any adapter (SOLID/LSP).
 *
 * An adapter imports `describeCrudContract` and calls it with a factory. The
 * SQLite adapter runs it; a future Postgres adapter runs the SAME suite,
 * unchanged. That is what makes "swap the repository" a claim with evidence
 * instead of an intention (ADR-0007 §4).
 *
 * The file is named `*.contract-test.ts`, not `*.test.ts`, so Vitest does NOT
 * collect it on its own: it is a suite to be called, and calling it is the
 * adapter's job.
 *
 * The four invariants below are the ones an adapter gets wrong in practice, and
 * the third is the one that matters most: **a repository that ignores `userId`
 * passes every other test in this file.**
 */

import { describe, expect, it } from 'vitest'
import type { Page, Reader, UserId, Writer } from './common'

export interface CrudHarness<T, New, Id> {
  readonly reader: Reader<T, Id>
  readonly writer: Writer<T, New, Id>
  /**
   * Creates whatever the aggregate references (a user row, a category, an
   * account) so a `create` can succeed. Called once per user id used in a test.
   */
  prepare?(userId: UserId): Promise<void>
  teardown?(): void | Promise<void>
}

export interface CrudContractSetup<T, New, Id> {
  /** Shown in the test title, e.g. "sqlite". */
  readonly adapter: string
  /** The aggregate's name, e.g. "BankAccount". */
  readonly aggregate: string
  create(): Promise<CrudHarness<T, New, Id>>
  /** Two distinguishable values; `seed` varies whatever the adapter can store. */
  sample(seed: number): New
  /** Returns a copy with at least one persisted field changed. */
  mutate(stored: T): T
  idOf(stored: T): Id
  /** An id that cannot exist. */
  missingId(): Id
}

const USER_A = 'contract-user-a' as UserId
const USER_B = 'contract-user-b' as UserId
const FIRST_PAGE: Page = { limit: 100, offset: 0 }

export function describeCrudContract<T, New, Id>(setup: CrudContractSetup<T, New, Id>): void {
  describe(`${setup.aggregate} repository contract — ${setup.adapter}`, () => {
    async function harness(users: readonly UserId[] = [USER_A]) {
      const built = await setup.create()
      for (const user of users) {
        await built.prepare?.(user)
      }
      return built
    }

    it('stores a value and reads it back by id', async () => {
      const { reader, writer, teardown } = await harness()
      const stored = await writer.create(USER_A, setup.sample(1))
      const read = await reader.findById(USER_A, setup.idOf(stored))
      expect(read).toEqual(stored)
      await teardown?.()
    })

    it('answers null for an id that does not exist, instead of throwing', async () => {
      // Absence is an answer. A throw would make every read site handle an
      // exception to render a 404, and one of them would forget.
      const { reader, teardown } = await harness()
      expect(await reader.findById(USER_A, setup.missingId())).toBeNull()
      await teardown?.()
    })

    it("ADR-0008 §3 — never returns another user's row, by id or in a list", async () => {
      const { reader, writer, teardown } = await harness([USER_A, USER_B])
      const mine = await writer.create(USER_A, setup.sample(1))
      await writer.create(USER_B, setup.sample(2))

      expect(await reader.findById(USER_B, setup.idOf(mine))).toBeNull()
      const listedForA = await reader.list(USER_A, FIRST_PAGE)
      expect(listedForA).toEqual([mine])
      expect(await reader.count(USER_A)).toBe(1)
      expect(await reader.count(USER_B)).toBe(1)
      await teardown?.()
    })

    it('persists a replacement rather than merging it', async () => {
      const { reader, writer, teardown } = await harness()
      const stored = await writer.create(USER_A, setup.sample(1))
      const changed = setup.mutate(stored)
      const returned = await writer.replace(USER_A, changed)

      expect(returned).toEqual(changed)
      expect(await reader.findById(USER_A, setup.idOf(stored))).toEqual(changed)
      await teardown?.()
    })

    it('ADR-0008 §3 — refuses to replace a row belonging to another user', async () => {
      const { reader, writer, teardown } = await harness([USER_A, USER_B])
      const mine = await writer.create(USER_A, setup.sample(1))
      const tampered = setup.mutate(mine)

      // Either it throws or it writes nothing. What it must NOT do is succeed.
      await writer.replace(USER_B, tampered).catch(() => undefined)
      expect(await reader.findById(USER_A, setup.idOf(mine))).toEqual(mine)
      await teardown?.()
    })

    it('removes a value, and removing an absent one is not an error', async () => {
      const { reader, writer, teardown } = await harness()
      const stored = await writer.create(USER_A, setup.sample(1))

      await writer.remove(USER_A, setup.idOf(stored))
      expect(await reader.findById(USER_A, setup.idOf(stored))).toBeNull()

      // Idempotent: the end state a caller asked for is already true.
      await expect(writer.remove(USER_A, setup.missingId())).resolves.toBeUndefined()
      await teardown?.()
    })

    it('assigns the id itself — the caller never supplies one', async () => {
      // The domain is pure and may not invent an id (src/domain/README.md), so
      // two creates from the same `New` value must not collide.
      const { writer, reader, teardown } = await harness()
      const first = await writer.create(USER_A, setup.sample(1))
      const second = await writer.create(USER_A, setup.sample(1))

      expect(setup.idOf(first)).not.toBe(setup.idOf(second))
      expect(await reader.count(USER_A)).toBe(2)
      await teardown?.()
    })
  })
}
