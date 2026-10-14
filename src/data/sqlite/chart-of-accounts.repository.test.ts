/**
 * Plano de Contas — SQLite adapter tests.
 *
 * `describeCrudContract` (src/data/contracts/crud.contract-test.ts) cannot run
 * here: `StatementBlockWriter` has no `create`/`remove` (blocks are fixed and
 * only ever `seed`ed or `replace`d) and `CategoryWriter` has no `remove`
 * (files_design/01 §3.1 — a category is archived, never deleted). Both ports
 * are therefore narrower than the generic `Writer<T, New, Id>` the suite is
 * written against, so this file is the bespoke suite for the two of them,
 * covering the same invariants the generic one checks: id assignment, the
 * user scope (ADR-0008 §3), and replace-vs-merge.
 */

import type BetterSqlite3 from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_BLOCKS, DEFAULT_CATEGORIES } from '@/domain/chart-of-accounts'
import { asId, type BlockId, type CategoryId } from '@/domain/core'
import type { UserId } from '@/data/contracts/common'
import {
  createCategoryRepository,
  createStatementBlockRepository,
} from './chart-of-accounts.repository'
import { createInMemoryDatabase, type BigornaDatabase } from './client'

const USER_A = 'user-a' as UserId
const USER_B = 'user-b' as UserId
const FIRST_PAGE = { limit: 100, offset: 0 }

let db: BigornaDatabase
let connection: BetterSqlite3.Database

function seedUser(id: UserId): void {
  connection.prepare('insert into users (id, created_at) values (?, ?)').run(id, '2026-01-01')
}

beforeEach(() => {
  const opened = createInMemoryDatabase()
  db = opened.db
  connection = opened.connection
  seedUser(USER_A)
  seedUser(USER_B)
})

afterEach(() => {
  connection.close()
})

describe('StatementBlock repository — sqlite', () => {
  it('seeds the 10 reference blocks and reads them back in cascade order', async () => {
    const { reader, writer } = createStatementBlockRepository(db)
    await writer.seed(USER_A, DEFAULT_BLOCKS)

    const listed = await reader.list(USER_A)
    expect(listed).toEqual(DEFAULT_BLOCKS)
    expect(await reader.count(USER_A)).toBe(10)
  })

  it('seeding twice is idempotent — the onboarding step can be retried', async () => {
    const { reader, writer } = createStatementBlockRepository(db)
    await writer.seed(USER_A, DEFAULT_BLOCKS)
    await writer.seed(USER_A, DEFAULT_BLOCKS)

    expect(await reader.count(USER_A)).toBe(10)
  })

  it('ADR-0008 §3 — never returns another user’s blocks', async () => {
    const { reader, writer } = createStatementBlockRepository(db)
    await writer.seed(USER_A, DEFAULT_BLOCKS)

    expect(await reader.list(USER_B)).toEqual([])
    expect(await reader.count(USER_B)).toBe(0)
    expect(await reader.findById(USER_B, DEFAULT_BLOCKS[0]!.id)).toBeNull()
  })

  it('answers null for a block id that does not exist, instead of throwing', async () => {
    const { reader, writer } = createStatementBlockRepository(db)
    await writer.seed(USER_A, DEFAULT_BLOCKS)

    expect(await reader.findById(USER_A, asId<BlockId>('does-not-exist'))).toBeNull()
  })

  it('replace persists a change and refuses a block that does not belong to this user', async () => {
    const { reader, writer } = createStatementBlockRepository(db)
    await writer.seed(USER_A, DEFAULT_BLOCKS)
    const original = DEFAULT_BLOCKS[0]!
    const changed = { ...original, statementLabel: 'Nova etiqueta' }

    await writer.replace(USER_A, changed)
    expect(await reader.findById(USER_A, original.id)).toEqual(changed)

    await expect(writer.replace(USER_B, changed)).rejects.toThrow('chart_of_accounts.unknown_block')
  })
})

describe('Category repository — sqlite', () => {
  async function seeded() {
    const blocks = createStatementBlockRepository(db)
    const cats = createCategoryRepository(db)
    await blocks.writer.seed(USER_A, DEFAULT_BLOCKS)
    await blocks.writer.seed(USER_B, DEFAULT_BLOCKS)
    return cats
  }

  it('seeds the reference categories and reads them back', async () => {
    const { reader, writer } = await seeded()
    await writer.seed(USER_A, DEFAULT_CATEGORIES)

    const listed = await reader.list(USER_A, FIRST_PAGE)
    expect(listed).toEqual(DEFAULT_CATEGORIES)
    expect(await reader.count(USER_A)).toBe(DEFAULT_CATEGORIES.length)
  })

  it('assigns the id itself — the caller never supplies one', async () => {
    const { reader, writer } = await seeded()
    const first = await writer.create(USER_A, {
      blockId: DEFAULT_BLOCKS[4]!.id,
      name: 'Café',
      isSystem: false,
      suggestedClassification: null,
      archived: false,
      isPassiveIncome: false,
    })
    const second = await writer.create(USER_A, {
      blockId: DEFAULT_BLOCKS[4]!.id,
      name: 'Chá',
      isSystem: false,
      suggestedClassification: null,
      archived: false,
      isPassiveIncome: false,
    })

    expect(first.id).not.toBe(second.id)
    expect(await reader.findById(USER_A, first.id)).toEqual(first)
    expect(await reader.count(USER_A)).toBe(2)
  })

  it('ADR-0008 §3 — never returns another user’s category, by id or in a list', async () => {
    const { reader, writer } = await seeded()
    const mine = await writer.create(USER_A, {
      blockId: DEFAULT_BLOCKS[4]!.id,
      name: 'Café',
      isSystem: false,
      suggestedClassification: null,
      archived: false,
      isPassiveIncome: false,
    })
    await writer.create(USER_B, {
      blockId: DEFAULT_BLOCKS[4]!.id,
      name: 'Chá',
      isSystem: false,
      suggestedClassification: null,
      archived: false,
      isPassiveIncome: false,
    })

    expect(await reader.findById(USER_B, mine.id)).toBeNull()
    expect(await reader.list(USER_A, FIRST_PAGE)).toEqual([mine])
    expect(await reader.count(USER_A)).toBe(1)
    expect(await reader.count(USER_B)).toBe(1)
  })

  it('replace persists a change and refuses a category that does not belong to this user', async () => {
    const { reader, writer } = await seeded()
    const created = await writer.create(USER_A, {
      blockId: DEFAULT_BLOCKS[4]!.id,
      name: 'Café',
      isSystem: false,
      suggestedClassification: null,
      archived: false,
      isPassiveIncome: false,
    })
    const renamed = { ...created, name: 'Cafezinho' }

    await writer.replace(USER_A, renamed)
    expect(await reader.findById(USER_A, created.id)).toEqual(renamed)

    await expect(writer.replace(USER_B, renamed)).rejects.toThrow(
      'chart_of_accounts.unknown_category',
    )
    // And USER_A's row is untouched by the refused attempt.
    expect(await reader.findById(USER_A, created.id)).toEqual(renamed)
  })

  it('listByBlock scopes to one block and listActive hides archived rows', async () => {
    const { reader, writer } = await seeded()
    await writer.seed(USER_A, DEFAULT_CATEGORIES)
    const personalExpenses = DEFAULT_BLOCKS[4]!.id
    const inBlock = await reader.listByBlock(USER_A, personalExpenses)
    expect(inBlock.every((c) => c.blockId === personalExpenses)).toBe(true)
    expect(inBlock.length).toBeGreaterThan(0)

    const [firstInBlock] = inBlock
    await writer.replace(USER_A, { ...firstInBlock!, archived: true })

    const active = await reader.listActive(USER_A)
    expect(active.some((c) => c.id === firstInBlock!.id)).toBe(false)
    // But the archived row is still readable directly (Histórico resolves it).
    expect(await reader.findById(USER_A, firstInBlock!.id)).toMatchObject({ archived: true })
  })

  it('preserves the order categories were stored in — rules.ts `categoriesOfBlock` relies on it', async () => {
    const { reader, writer } = await seeded()
    await writer.seed(USER_A, DEFAULT_CATEGORIES)

    const personalExpenses = DEFAULT_BLOCKS[4]!.id
    const expectedOrder = DEFAULT_CATEGORIES.filter((c) => c.blockId === personalExpenses).map(
      (c) => c.id,
    )
    const stored = await reader.listByBlock(USER_A, personalExpenses)
    expect(stored.map((c) => c.id)).toEqual(expectedOrder)
  })

  it('seeding twice is idempotent', async () => {
    const { reader, writer } = await seeded()
    await writer.seed(USER_A, DEFAULT_CATEGORIES)
    await writer.seed(USER_A, DEFAULT_CATEGORIES)

    expect(await reader.count(USER_A)).toBe(DEFAULT_CATEGORIES.length)
  })

  it('answers null for a category id that does not exist, instead of throwing', async () => {
    const { reader } = await seeded()
    expect(await reader.findById(USER_A, asId<CategoryId>('does-not-exist'))).toBeNull()
  })

  it('seed is all-or-nothing — a failing row leaves no half-written chart', async () => {
    const { reader, writer } = await seeded()

    await expect(
      writer.seed(USER_A, [
        DEFAULT_CATEGORIES[0]!,
        DEFAULT_CATEGORIES[1]!,
        // No such block for this user: the foreign key rejects the 3rd row.
        { ...DEFAULT_CATEGORIES[2]!, blockId: asId<BlockId>('bloco-inexistente') },
        DEFAULT_CATEGORIES[3]!,
      ]),
    ).rejects.toThrow()

    // Without the transaction this answered 2: the first two rows had committed.
    expect(await reader.count(USER_A)).toBe(0)
  })
})
