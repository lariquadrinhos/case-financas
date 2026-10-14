/**
 * Passivos — SQLite adapter tests for the three ports in
 * `liabilities.repository.ts`.
 */

import type BetterSqlite3 from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { describeCrudContract } from '@/data/contracts/crud.contract-test'
import { buildInstallmentSchedule } from '@/domain/assets'
import type { Liability } from '@/domain/assets'
import { asId, cents, type IsoDate, type LiabilityId } from '@/domain/core'
import type { UserId } from '@/data/contracts/common'
import type { NewLiability } from '@/data/contracts/liabilities'
import {
  createInstallmentRepository,
  createLiabilityRepository,
  createRateAdjustmentRepository,
} from './liabilities.repository'
import { createInMemoryDatabase, type BigornaDatabase } from './client'

const USER_A = 'user-a' as UserId

function seedUser(connection: BetterSqlite3.Database, id: UserId): void {
  connection.prepare('insert into users (id, created_at) values (?, ?)').run(id, '2026-01-01')
}

describeCrudContract<Liability, NewLiability, LiabilityId>({
  adapter: 'sqlite',
  aggregate: 'Liability',
  async create() {
    const { db, connection } = createInMemoryDatabase()
    return {
      reader: createLiabilityRepository(db).reader,
      writer: createLiabilityRepository(db).writer,
      async prepare(userId) {
        seedUser(connection, userId)
      },
      teardown() {
        connection.close()
      },
    }
  },
  sample: (seed) => ({
    name: `Financiamento ${seed}`,
    creditor: 'Banco X',
    entity: seed % 2 === 0 ? 'PF' : 'PJ',
    classification: 'NonCurrent',
    originalAmount: cents(seed * 10000),
    installmentAmount: cents(seed * 1000),
    installmentCount: 12,
    installmentsAlreadyPaid: 0,
    monthlyInterestRate: 0.008,
    startDate: '2026-01-10' as IsoDate,
  }),
  mutate: (stored) => ({ ...stored, name: `${stored.name} (editado)` }),
  idOf: (stored) => stored.id,
  missingId: () => asId<LiabilityId>('does-not-exist'),
})

describe('Liability repository — sqlite specifics', () => {
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

  it('listByEntity scopes the Passivos list to one entity', async () => {
    const { reader, writer } = createLiabilityRepository(db)
    const pf = await writer.create(USER_A, {
      name: 'Financiamento apartamento',
      creditor: 'Banco X',
      entity: 'PF',
      classification: 'NonCurrent',
      originalAmount: cents(32000000),
      installmentAmount: cents(150000),
      installmentCount: 360,
      installmentsAlreadyPaid: 0,
      monthlyInterestRate: 0.008,
      startDate: '2026-01-10' as IsoDate,
    })
    await writer.create(USER_A, {
      name: 'Cartão PJ',
      creditor: 'Banco Y',
      entity: 'PJ',
      classification: 'Current',
      originalAmount: cents(500000),
      installmentAmount: cents(50000),
      installmentCount: 10,
      installmentsAlreadyPaid: 0,
      monthlyInterestRate: 0.01,
      startDate: '2026-02-01' as IsoDate,
    })

    expect(await reader.listByEntity(USER_A, 'PF')).toEqual([pf])
  })
})

describe('Installment repository — sqlite', () => {
  let db: BigornaDatabase
  let connection: BetterSqlite3.Database
  let liability: Liability

  beforeEach(async () => {
    const opened = createInMemoryDatabase()
    db = opened.db
    connection = opened.connection
    seedUser(connection, USER_A)
    const { writer } = createLiabilityRepository(db)
    liability = await writer.create(USER_A, {
      name: 'Financiamento apartamento',
      creditor: 'Banco X',
      entity: 'PF',
      classification: 'NonCurrent',
      originalAmount: cents(32000000),
      installmentAmount: cents(150000),
      installmentCount: 12,
      installmentsAlreadyPaid: 0,
      monthlyInterestRate: 0.008,
      startDate: '2026-01-10' as IsoDate,
    })
  })

  afterEach(() => {
    connection.close()
  })

  it('replaceSchedule stores the whole schedule built from the Passivo form', async () => {
    const { reader, writer } = createInstallmentRepository(db)
    const schedule = buildInstallmentSchedule(liability)

    const stored = await writer.replaceSchedule(USER_A, liability.id, schedule)

    expect(stored).toEqual(schedule)
    expect(await reader.listByLiability(USER_A, liability.id)).toEqual(schedule)
  })

  it('replaceSchedule OVERWRITES the previous schedule rather than appending to it', async () => {
    const { reader, writer } = createInstallmentRepository(db)
    const first = buildInstallmentSchedule(liability)
    await writer.replaceSchedule(USER_A, liability.id, first)

    // A reajuste rebuilds the schedule with fewer remaining rows in practice;
    // here a shorter synthetic schedule stands in for that recomputation.
    const shorter = first.slice(0, 3)
    await writer.replaceSchedule(USER_A, liability.id, shorter)

    const listed = await reader.listByLiability(USER_A, liability.id)
    expect(listed).toHaveLength(3)
    expect(listed).toEqual(shorter)
  })

  it('replace updates one installment (Marcar Paga) without touching the others', async () => {
    const { reader, writer } = createInstallmentRepository(db)
    const schedule = await writer.replaceSchedule(
      USER_A,
      liability.id,
      buildInstallmentSchedule(liability),
    )
    const first = schedule[0]!

    const paid = { ...first, status: 'Paid' as const, paidAmount: first.plannedAmount }
    const returned = await writer.replace(USER_A, paid)

    expect(returned).toEqual(paid)
    const listed = await reader.listByLiability(USER_A, liability.id)
    expect(listed[0]).toEqual(paid)
    expect(listed[1]).toEqual(schedule[1])
  })

  it('ADR-0008 §3 — listByLiability never returns another user’s installments', async () => {
    seedUser(connection, 'user-b' as UserId)
    const liabilityRepo = createLiabilityRepository(db)
    const otherLiability = await liabilityRepo.writer.create('user-b' as UserId, {
      name: 'Outro financiamento',
      creditor: 'Banco Z',
      entity: 'PF',
      classification: 'NonCurrent',
      originalAmount: cents(1000000),
      installmentAmount: cents(50000),
      installmentCount: 6,
      installmentsAlreadyPaid: 0,
      monthlyInterestRate: 0.01,
      startDate: '2026-01-01' as IsoDate,
    })
    const { reader, writer } = createInstallmentRepository(db)
    await writer.replaceSchedule(
      'user-b' as UserId,
      otherLiability.id,
      buildInstallmentSchedule(otherLiability),
    )
    await writer.replaceSchedule(USER_A, liability.id, buildInstallmentSchedule(liability))

    expect(await reader.listByLiability('user-b' as UserId, liability.id)).toEqual([])
  })
})

describe('RateAdjustment repository — sqlite', () => {
  let db: BigornaDatabase
  let connection: BetterSqlite3.Database
  let liability: Liability

  beforeEach(async () => {
    const opened = createInMemoryDatabase()
    db = opened.db
    connection = opened.connection
    seedUser(connection, USER_A)
    const { writer } = createLiabilityRepository(db)
    liability = await writer.create(USER_A, {
      name: 'Financiamento apartamento',
      creditor: 'Banco X',
      entity: 'PF',
      classification: 'NonCurrent',
      originalAmount: cents(32000000),
      installmentAmount: cents(150000),
      installmentCount: 12,
      installmentsAlreadyPaid: 0,
      monthlyInterestRate: 0.008,
      startDate: '2026-01-10' as IsoDate,
    })
  })

  afterEach(() => {
    connection.close()
  })

  it('append is append-only — a second reajuste does not erase the first', async () => {
    const { reader, writer } = createRateAdjustmentRepository(db)
    await writer.append(USER_A, {
      liabilityId: liability.id,
      newRate: 0.0085,
      effectiveFrom: '2026-03-01' as IsoDate,
    })
    await writer.append(USER_A, {
      liabilityId: liability.id,
      newRate: 0.009,
      effectiveFrom: '2026-06-01' as IsoDate,
    })

    const listed = await reader.listByLiability(USER_A, liability.id)
    expect(listed).toEqual([
      { liabilityId: liability.id, newRate: 0.0085, effectiveFrom: '2026-03-01' },
      { liabilityId: liability.id, newRate: 0.009, effectiveFrom: '2026-06-01' },
    ])
  })
})
