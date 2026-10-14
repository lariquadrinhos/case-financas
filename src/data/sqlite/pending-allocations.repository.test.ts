/**
 * Pendente de Direcionamento — SQLite adapter tests.
 *
 * `describeCrudContract` covers the shape every `Reader`/`Writer` must satisfy
 * (id assignment, user scope, replace-vs-merge, remove). This file adds only
 * what is specific to pending allocations: `listByStatus`, oldest-first.
 */

import type BetterSqlite3 from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { describeCrudContract } from '@/data/contracts/crud.contract-test'
import type { PendingAllocation } from '@/domain/assets'
import { cents, isoDate } from '@/domain/core'
import { asId, type PendingAllocationId, type TangibleAssetId } from '@/domain/core'
import type { UserId } from '@/data/contracts/common'
import type { NewPendingAllocation } from '@/data/contracts/pending-allocations'
import { createPendingAllocationRepository } from './pending-allocations.repository'
import { createInMemoryDatabase, type BigornaDatabase } from './client'

const USER_A = 'user-a' as UserId
const ASSET_A = asId<TangibleAssetId>('bem-a')
const ASSET_B = asId<TangibleAssetId>('bem-b')

function seedUser(connection: BetterSqlite3.Database, id: UserId): void {
  connection.prepare('insert into users (id, created_at) values (?, ?)').run(id, '2026-01-01')
}

function seedAsset(connection: BetterSqlite3.Database, userId: UserId, id: TangibleAssetId): void {
  connection
    .prepare(
      `insert into tangible_assets (user_id, id, name, entity, recorded_value, sold_on)
       values (?, ?, 'Carro antigo', 'PF', 3000000, '2026-07-10')`,
    )
    .run(userId, id)
}

describeCrudContract<PendingAllocation, NewPendingAllocation, PendingAllocationId>({
  adapter: 'sqlite',
  aggregate: 'PendingAllocation',
  async create() {
    const { db, connection } = createInMemoryDatabase()
    return {
      reader: createPendingAllocationRepository(db).reader,
      writer: createPendingAllocationRepository(db).writer,
      async prepare(userId) {
        seedUser(connection, userId)
        seedAsset(connection, userId, ASSET_A)
      },
      teardown() {
        connection.close()
      },
    }
  },
  sample: (seed) => ({
    origin: { kind: 'TangibleAssetSale', tangibleAssetId: ASSET_A },
    amount: cents(seed * 1_000),
    originDate: isoDate('2026-07-10'),
    status: 'Pending',
  }),
  mutate: (stored) => ({ ...stored, status: 'Allocated' }),
  idOf: (stored) => stored.id,
  missingId: () => asId<PendingAllocationId>('does-not-exist'),
})

describe('PendingAllocation repository — sqlite specifics', () => {
  let db: BigornaDatabase
  let connection: BetterSqlite3.Database

  beforeEach(() => {
    const opened = createInMemoryDatabase()
    db = opened.db
    connection = opened.connection
    seedUser(connection, USER_A)
    seedAsset(connection, USER_A, ASSET_A)
    seedAsset(connection, USER_A, ASSET_B)
  })

  afterEach(() => {
    connection.close()
  })

  it('listByStatus returns only the matching status, oldest origin date first (PRD §1)', async () => {
    const { writer, reader } = createPendingAllocationRepository(db)
    const newer = await writer.create(USER_A, {
      origin: { kind: 'TangibleAssetSale', tangibleAssetId: ASSET_B },
      amount: cents(5_000),
      originDate: isoDate('2026-07-20'),
      status: 'Pending',
    })
    const older = await writer.create(USER_A, {
      origin: { kind: 'TangibleAssetSale', tangibleAssetId: ASSET_A },
      amount: cents(2_000),
      originDate: isoDate('2026-07-01'),
      status: 'Pending',
    })
    const resolved = await writer.create(USER_A, {
      origin: { kind: 'TangibleAssetSale', tangibleAssetId: ASSET_A },
      amount: cents(1_000),
      originDate: isoDate('2026-06-01'),
      status: 'Allocated',
    })

    const pending = await reader.listByStatus(USER_A, 'Pending')
    expect(pending).toEqual([older, newer])

    const allocated = await reader.listByStatus(USER_A, 'Allocated')
    expect(allocated).toEqual([resolved])
  })

  it('ADR-0008 §3 — listByStatus never returns another user’s rows', async () => {
    const { writer, reader } = createPendingAllocationRepository(db)
    await writer.create(USER_A, {
      origin: { kind: 'TangibleAssetSale', tangibleAssetId: ASSET_A },
      amount: cents(1_000),
      originDate: isoDate('2026-07-01'),
      status: 'Pending',
    })

    const otherUser = 'user-b' as UserId
    seedUser(connection, otherUser)
    expect(await reader.listByStatus(otherUser, 'Pending')).toEqual([])
  })
})
