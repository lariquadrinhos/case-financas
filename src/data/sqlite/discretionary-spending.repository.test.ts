/**
 * Consumo Livre — SQLite adapter tests.
 *
 * Bespoke on both halves: the config is a per-person singleton (no id, no
 * list) and an expense is backed by two tables at once (schema.ts) — neither
 * shape fits `describeCrudContract`.
 */

import type BetterSqlite3 from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DISCRETIONARY_CATEGORY_ID } from '@/domain/chart-of-accounts'
import type { DiscretionarySpendingConfig } from '@/domain/discretionary-spending'
import { cents, isoDate, month } from '@/domain/core'
import { asId, type BankAccountId } from '@/domain/core'
import type { UserId } from '@/data/contracts/common'
import {
  createDiscretionaryExpenseRepository,
  createDiscretionarySpendingConfigRepository,
} from './discretionary-spending.repository'
import { createInMemoryDatabase, type BigornaDatabase } from './client'

const USER_A = 'user-a' as UserId
const USER_B = 'user-b' as UserId
const ACCOUNT = asId<BankAccountId>('conta-nubank-pf')

function seedUser(connection: BetterSqlite3.Database, id: UserId): void {
  connection.prepare('insert into users (id, created_at) values (?, ?)').run(id, '2026-01-01')
}

function seedAccount(connection: BetterSqlite3.Database, userId: UserId, id: BankAccountId): void {
  connection
    .prepare(
      `insert into bank_accounts (user_id, id, label, colour, entity, balance)
       values (?, ?, 'Nubank', 'nubank', 'PF', 100000)`,
    )
    .run(userId, id)
}

/**
 * `entries.category_id` RESTRICTs against `categories` (schema.ts) — a real
 * Onboarding seeds the whole Plano de Contas, but here only the ONE category
 * the widget ever posts to (`DISCRETIONARY_CATEGORY_ID`) needs to exist.
 */
function seedDiscretionaryCategory(connection: BetterSqlite3.Database, userId: UserId): void {
  connection
    .prepare(
      `insert into statement_blocks
         (user_id, id, name, sort_order, effect, below_the_line, accepts_user_categories)
       values (?, 'personal-expenses', 'Despesas Pessoais/Consumo', 5, 'Subtract', 0, 1)`,
    )
    .run(userId)
  connection
    .prepare(
      `insert into categories (user_id, id, block_id, name, is_system)
       values (?, ?, 'personal-expenses', 'Consumo Livre', 1)`,
    )
    .run(userId, DISCRETIONARY_CATEGORY_ID)
}

const CONFIG: DiscretionarySpendingConfig = {
  monthlyAmount: cents(50_000),
  sourceAccountId: ACCOUNT,
  entity: 'PF',
}

let db: BigornaDatabase
let connection: BetterSqlite3.Database

beforeEach(() => {
  const opened = createInMemoryDatabase()
  db = opened.db
  connection = opened.connection
  seedUser(connection, USER_A)
  seedUser(connection, USER_B)
  seedAccount(connection, USER_A, ACCOUNT)
  seedDiscretionaryCategory(connection, USER_A)
})

afterEach(() => {
  connection.close()
})

describe('DiscretionarySpendingConfig repository — sqlite', () => {
  it('find answers null before the widget was ever configured (Estado A)', async () => {
    const { reader } = createDiscretionarySpendingConfigRepository(db)
    expect(await reader.find(USER_A)).toBeNull()
  })

  it('save is an upsert on the person — a singleton, never a list', async () => {
    const { reader, writer } = createDiscretionarySpendingConfigRepository(db)
    await writer.save(USER_A, CONFIG)
    // Sem `allowanceKind`, a configuração é de valor fixo (2026-09-29).
    expect(await reader.find(USER_A)).toEqual({ ...CONFIG, allowanceKind: 'Fixed' })

    const changed: DiscretionarySpendingConfig = {
      ...CONFIG,
      monthlyAmount: cents(80_000),
      allowanceKind: 'SourceBalance',
    }
    await writer.save(USER_A, changed)
    expect(await reader.find(USER_A)).toEqual(changed)
  })

  it('ADR-0008 §3 — never returns another user’s configuration', async () => {
    const { reader, writer } = createDiscretionarySpendingConfigRepository(db)
    await writer.save(USER_A, CONFIG)
    expect(await reader.find(USER_B)).toBeNull()
  })
})

describe('DiscretionaryExpense repository — sqlite', () => {
  beforeEach(async () => {
    const { writer } = createDiscretionarySpendingConfigRepository(db)
    await writer.save(USER_A, CONFIG)
  })

  it('2026-09-29 — create grava a Descrição no Lançamento quando a importação a informa', async () => {
    const { writer } = createDiscretionaryExpenseRepository(db)
    const stored = await writer.create(USER_A, {
      date: isoDate('2026-07-12'),
      amount: cents(4_500),
      label: 'Texto sintético',
      description: 'Texto sintético',
    })
    const entryRow = connection
      .prepare('select description from entries where user_id = ? and id = ?')
      .get(USER_A, stored.id) as { description: string | null }
    expect(entryRow.description).toBe('Texto sintético')
  })

  it('create builds the Lançamento itself — the caller supplies only the amount, date and label', async () => {
    const { writer, reader } = createDiscretionaryExpenseRepository(db)
    const stored = await writer.create(USER_A, {
      date: isoDate('2026-07-12'),
      amount: cents(4_500),
      label: null,
    })

    expect(await reader.findById(USER_A, stored.id)).toEqual(stored)

    // The real Lançamento exists, posted to the fixed system category with the
    // account and entity from the config (files_design/03).
    const entryRow = connection
      .prepare('select * from entries where user_id = ? and id = ?')
      .get(USER_A, stored.id) as Record<string, unknown>
    expect(entryRow.kind).toBe('Expense')
    expect(entryRow.category_id).toBe(DISCRETIONARY_CATEGORY_ID)
    expect(entryRow.bank_account_id).toBe(ACCOUNT)
    expect(entryRow.entity).toBe('PF')
    expect(entryRow.status).toBe('Paid')
    expect(entryRow.amount).toBe(4_500)
  })

  it('refuses to create a gasto before the widget was configured', async () => {
    const { writer } = createDiscretionaryExpenseRepository(db)
    await expect(
      writer.create(USER_B, { date: isoDate('2026-07-12'), amount: cents(1_000), label: null }),
    ).rejects.toThrow('discretionary_spending.not_configured')
  })

  it('listByMonth returns the gastos of one month, in date order', async () => {
    const { writer, reader } = createDiscretionaryExpenseRepository(db)
    const first = await writer.create(USER_A, {
      date: isoDate('2026-07-05'),
      amount: cents(1_000),
      label: null,
    })
    const second = await writer.create(USER_A, {
      date: isoDate('2026-07-20'),
      amount: cents(2_000),
      label: null,
    })
    await writer.create(USER_A, { date: isoDate('2026-08-01'), amount: cents(3_000), label: null })

    expect(await reader.listByMonth(USER_A, month('2026-07'))).toEqual([first, second])
  })

  it('replace edits Valor and Rótulo only — no other field of the Lançamento moves', async () => {
    const { writer, reader } = createDiscretionaryExpenseRepository(db)
    const stored = await writer.create(USER_A, {
      date: isoDate('2026-07-12'),
      amount: cents(4_500),
      label: null,
    })

    const edited = { ...stored, amount: cents(6_000), label: 'Mercado' }
    await writer.replace(USER_A, edited)

    expect(await reader.findById(USER_A, stored.id)).toEqual(edited)
    const entryRow = connection
      .prepare('select * from entries where user_id = ? and id = ?')
      .get(USER_A, stored.id) as Record<string, unknown>
    expect(entryRow.date).toBe('2026-07-12')
    expect(entryRow.bank_account_id).toBe(ACCOUNT)
  })

  it('refuses to replace a gasto that does not exist', async () => {
    const { writer } = createDiscretionaryExpenseRepository(db)
    await expect(
      writer.replace(USER_A, {
        id: asId('does-not-exist'),
        date: isoDate('2026-07-12'),
        amount: cents(1_000),
        label: null,
      }),
    ).rejects.toThrow('discretionary_spending.expense_not_found')
  })

  it('remove deletes both the side row and the underlying Lançamento', async () => {
    const { writer, reader } = createDiscretionaryExpenseRepository(db)
    const stored = await writer.create(USER_A, {
      date: isoDate('2026-07-12'),
      amount: cents(4_500),
      label: null,
    })

    await writer.remove(USER_A, stored.id)

    expect(await reader.findById(USER_A, stored.id)).toBeNull()
    const entryRow = connection
      .prepare('select * from entries where user_id = ? and id = ?')
      .get(USER_A, stored.id)
    expect(entryRow).toBeUndefined()
  })

  it('removing an absent gasto is not an error', async () => {
    const { writer } = createDiscretionaryExpenseRepository(db)
    await expect(writer.remove(USER_A, asId('does-not-exist'))).resolves.toBeUndefined()
  })

  it('ADR-0008 §3 — never returns another user’s gasto', async () => {
    const { writer, reader } = createDiscretionaryExpenseRepository(db)
    const mine = await writer.create(USER_A, {
      date: isoDate('2026-07-12'),
      amount: cents(4_500),
      label: null,
    })
    expect(await reader.findById(USER_B, mine.id)).toBeNull()
  })
})
