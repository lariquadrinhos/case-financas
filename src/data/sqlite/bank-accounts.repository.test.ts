/**
 * Contas Bancárias — SQLite adapter tests.
 *
 * `describeCrudContract` covers the shape every `Reader`/`Writer` must satisfy
 * (id assignment, user scope, replace-vs-merge). This file adds only what is
 * specific to bank accounts: `listByEntity` and the RESTRICT-turned-409 on delete.
 */

import type BetterSqlite3 from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { describeCrudContract } from '@/data/contracts/crud.contract-test'
import type { BankAccount } from '@/domain/assets'
import { cents } from '@/domain/core'
import { asId, type BankAccountId } from '@/domain/core'
import type { UserId } from '@/data/contracts/common'
import type { NewBankAccount } from '@/data/contracts/bank-accounts'
import { createBankAccountRepository } from './bank-accounts.repository'
import { createInMemoryDatabase, type BigornaDatabase } from './client'

const USER_A = 'user-a' as UserId

function seedUser(connection: BetterSqlite3.Database, id: UserId): void {
  connection.prepare('insert into users (id, created_at) values (?, ?)').run(id, '2026-01-01')
}

describeCrudContract<BankAccount, NewBankAccount, BankAccountId>({
  adapter: 'sqlite',
  aggregate: 'BankAccount',
  async create() {
    const { db, connection } = createInMemoryDatabase()
    return {
      reader: createBankAccountRepository(db).reader,
      writer: createBankAccountRepository(db).writer,
      async prepare(userId) {
        seedUser(connection, userId)
      },
      teardown() {
        connection.close()
      },
    }
  },
  sample: (seed) => ({
    label: `Conta ${seed}`,
    colour: 'nubank',
    entity: seed % 2 === 0 ? 'PF' : 'PJ',
    balance: cents(seed * 100),
  }),
  mutate: (stored) => ({ ...stored, label: `${stored.label} (editada)` }),
  idOf: (stored) => stored.id,
  missingId: () => asId<BankAccountId>('does-not-exist'),
})

describe('BankAccount repository — sqlite specifics', () => {
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

  it('listByEntity filters PJ accounts for the Pró-labore origin dropdown', async () => {
    const { reader, writer } = createBankAccountRepository(db)
    const pf = await writer.create(USER_A, {
      label: 'Nubank PF',
      colour: 'nubank',
      entity: 'PF',
      balance: cents(1000),
    })
    const pj = await writer.create(USER_A, {
      label: 'Itaú PJ',
      colour: 'banco-do-brasil',
      entity: 'PJ',
      balance: cents(2000),
    })

    expect(await reader.listByEntity(USER_A, 'PJ')).toEqual([pj])
    expect(await reader.listByEntity(USER_A, 'PF')).toEqual([pf])
  })

  it('ADR-0012 §2 — a FK RESTRICT on the account surfaces as 409, not a raw driver error', async () => {
    const { writer } = createBankAccountRepository(db)
    const account = await writer.create(USER_A, {
      label: 'Nubank PF',
      colour: 'nubank',
      entity: 'PF',
      balance: cents(1000),
    })
    // `discretionary_spending_config` is the smallest table with a FK to
    // `bank_accounts` — enough to trip RESTRICT without depending on the (not
    // yet built) entries repository.
    connection
      .prepare(
        `insert into discretionary_spending_config (user_id, monthly_amount, source_account_id, entity)
         values (?, 50000, ?, 'PF')`,
      )
      .run(USER_A, account.id)

    await expect(writer.remove(USER_A, account.id)).rejects.toThrow('bank_accounts.in_use')
  })

  it('removing an account with no references succeeds', async () => {
    const { reader, writer } = createBankAccountRepository(db)
    const account = await writer.create(USER_A, {
      label: 'Conta livre',
      colour: 'itau',
      entity: 'PF',
      balance: cents(500),
    })
    await writer.remove(USER_A, account.id)
    expect(await reader.findById(USER_A, account.id)).toBeNull()
  })
})
