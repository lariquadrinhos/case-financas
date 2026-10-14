/**
 * Investimentos — SQLite adapter tests.
 */

import type BetterSqlite3 from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { describeCrudContract } from '@/data/contracts/crud.contract-test'
import type { Investment } from '@/domain/assets'
import { cents } from '@/domain/core'
import { asId, type InvestmentId } from '@/domain/core'
import type { UserId } from '@/data/contracts/common'
import type { NewInvestment } from '@/data/contracts/investments'
import { createInvestmentRepository } from './investments.repository'
import { createInMemoryDatabase, type BigornaDatabase } from './client'

const USER_A = 'user-a' as UserId

function seedUser(connection: BetterSqlite3.Database, id: UserId): void {
  connection.prepare('insert into users (id, created_at) values (?, ?)').run(id, '2026-01-01')
}

describeCrudContract<Investment, NewInvestment, InvestmentId>({
  adapter: 'sqlite',
  aggregate: 'Investment',
  async create() {
    const { db, connection } = createInMemoryDatabase()
    return {
      reader: createInvestmentRepository(db).reader,
      writer: createInvestmentRepository(db).writer,
      async prepare(userId) {
        seedUser(connection, userId)
      },
      teardown() {
        connection.close()
      },
    }
  },
  sample: (seed) => ({
    name: `Investimento ${seed}`,
    entity: seed % 2 === 0 ? 'PF' : 'PJ',
    accumulatedValue: cents(seed * 1000),
  }),
  mutate: (stored) => ({ ...stored, accumulatedValue: cents(stored.accumulatedValue + 100) }),
  idOf: (stored) => stored.id,
  missingId: () => asId<InvestmentId>('does-not-exist'),
})

describe('Investment repository — sqlite specifics', () => {
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

  it('listByEntity scopes the Aporte em Investimentos search to one entity', async () => {
    const { reader, writer } = createInvestmentRepository(db)
    const pf = await writer.create(USER_A, {
      name: 'Tesouro Direto',
      entity: 'PF',
      accumulatedValue: cents(300000),
    })
    await writer.create(USER_A, { name: 'CDB PJ', entity: 'PJ', accumulatedValue: cents(150000) })

    expect(await reader.listByEntity(USER_A, 'PF')).toEqual([pf])
  })
})
