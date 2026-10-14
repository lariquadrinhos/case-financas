/**
 * Bens Materiais — SQLite adapter tests.
 */

import type BetterSqlite3 from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { describeCrudContract } from '@/data/contracts/crud.contract-test'
import type { TangibleAsset } from '@/domain/assets'
import { cents } from '@/domain/core'
import { asId, type IsoDate, type TangibleAssetId } from '@/domain/core'
import type { UserId } from '@/data/contracts/common'
import type { NewTangibleAsset } from '@/data/contracts/tangible-assets'
import { createTangibleAssetRepository } from './tangible-assets.repository'
import { createInMemoryDatabase, type BigornaDatabase } from './client'

const USER_A = 'user-a' as UserId

function seedUser(connection: BetterSqlite3.Database, id: UserId): void {
  connection.prepare('insert into users (id, created_at) values (?, ?)').run(id, '2026-01-01')
}

describeCrudContract<TangibleAsset, NewTangibleAsset, TangibleAssetId>({
  adapter: 'sqlite',
  aggregate: 'TangibleAsset',
  async create() {
    const { db, connection } = createInMemoryDatabase()
    return {
      reader: createTangibleAssetRepository(db).reader,
      writer: createTangibleAssetRepository(db).writer,
      async prepare(userId) {
        seedUser(connection, userId)
      },
      teardown() {
        connection.close()
      },
    }
  },
  sample: (seed) => ({
    name: `Bem ${seed}`,
    entity: seed % 2 === 0 ? 'PF' : 'PJ',
    recordedValue: cents(seed * 1000),
  }),
  mutate: (stored) => ({ ...stored, name: `${stored.name} (editado)` }),
  idOf: (stored) => stored.id,
  missingId: () => asId<TangibleAssetId>('does-not-exist'),
})

describe('TangibleAsset repository — sqlite specifics', () => {
  let db: BigornaDatabase
  let connection: BetterSqlite3.Database

  beforeEach(() => {
    const opened = createInMemoryDatabase()
    db = opened.db
    connection = opened.connection
    seedUser(connection, USER_A)
  })

  afterEach(() => {
    connection.close()
  })

  it('listUnsold hides a sold asset without deleting it — the past Balanço still needs it', async () => {
    const { reader, writer } = createTangibleAssetRepository(db)
    const kept = await writer.create(USER_A, {
      name: 'Apartamento',
      entity: 'PF',
      recordedValue: cents(500000),
    })
    const sold = await writer.create(USER_A, {
      name: 'Carro',
      entity: 'PF',
      recordedValue: cents(80000),
    })

    const afterSale = await writer.replace(USER_A, { ...sold, soldOn: '2026-03-10' as IsoDate })

    expect(await reader.listUnsold(USER_A)).toEqual([kept])
    expect(await reader.findById(USER_A, sold.id)).toEqual(afterSale)
    expect(await reader.count(USER_A)).toBe(2)
  })

  it('new assets are created unsold', async () => {
    const { writer } = createTangibleAssetRepository(db)
    const asset = await writer.create(USER_A, {
      name: 'Moto',
      entity: 'PF',
      recordedValue: cents(20000),
    })
    expect(asset.soldOn).toBeNull()
  })
})
