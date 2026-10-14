/**
 * Recorrência e Ocorrência — SQLite adapter tests.
 *
 * `RecurrenceReader`/`RecurrenceWriter` are a plain `Reader`/`Writer` with
 * random ids (two identical séries are still two séries), so
 * `describeCrudContract` applies unmodified.
 *
 * `OccurrenceReader`/`OccurrenceWriter` are NOT run through that suite: its
 * "assigns the id itself" test requires two `create()` calls with the SAME
 * `New` value to produce DIFFERENT ids, and an occurrence is the opposite —
 * (recurrenceId, month) is a natural key, and `create` is an idempotent
 * get-or-create keyed by it (see recurrences.repository.ts's header comment).
 * This file is the bespoke suite that protects that invariant instead,
 * mirroring the precedent already set by `chart-of-accounts.repository.test.ts`
 * for `StatementBlockWriter`/`CategoryWriter`.
 */

import { describe, expect, it } from 'vitest'

import { describeCrudContract } from '@/data/contracts/crud.contract-test'
import {
  asId,
  cents,
  isoDate,
  month,
  type BankAccountId,
  type CategoryId,
  type EntryId,
  type OccurrenceId,
  type RecurrenceId,
} from '@/domain/core'
import { occurrenceIdFor } from '@/domain/recurrence'
import type { Occurrence, Recurrence } from '@/domain/recurrence'
import type { NewRecurrence } from '@/data/contracts/recurrences'
import type { UserId } from '@/data/contracts/common'
import { createOccurrenceRepository, createRecurrenceRepository } from './recurrences.repository'
import { createInMemoryDatabase, type BigornaDatabase } from './client'
import { bankAccounts, categories, entries, statementBlocks } from './schema'

const CATEGORY_ID = 'aluguel-moradia' as CategoryId
const PF_ACCOUNT_ID = 'conta-pf' as BankAccountId
const USER_A = 'user-a' as UserId
const USER_B = 'user-b' as UserId

function seedUser(db: BigornaDatabase, userId: UserId): void {
  db.insert(statementBlocks)
    .values({
      userId,
      id: 'despesas-pessoais',
      name: 'Despesas Pessoais/Consumo',
      order: 5,
      effect: 'Subtract',
      belowTheLine: false,
      acceptsUserCategories: true,
      statementLabel: null,
    })
    .run()
  db.insert(categories)
    .values({ userId, id: CATEGORY_ID, blockId: 'despesas-pessoais', name: 'Aluguel moradia' })
    .run()
  db.insert(bankAccounts)
    .values({
      userId,
      id: PF_ACCOUNT_ID,
      label: 'Conta PF',
      colour: 'banco-do-brasil',
      entity: 'PF',
      balance: 0,
    })
    .run()
}

function newRecurrence(overrides: Partial<NewRecurrence> = {}): NewRecurrence {
  return {
    template: {
      kind: 'Expense',
      amount: cents(150_000),
      entity: 'PF',
      categoryId: CATEGORY_ID,
      classification: 'Current',
      bankAccountId: PF_ACCOUNT_ID,
    },
    amountKind: 'Fixed',
    startDate: isoDate('2026-01-10'),
    endsOn: null,
    ...overrides,
  }
}

describeCrudContract({
  adapter: 'sqlite',
  aggregate: 'Recurrence',
  async create() {
    const { db, connection } = createInMemoryDatabase()
    const repo = createRecurrenceRepository(db)
    return {
      reader: repo.reader,
      writer: repo.writer,
      async prepare(userId) {
        connection
          .prepare('insert into users (id, created_at) values (?, ?)')
          .run(userId, '2026-01-01')
        seedUser(db, userId)
      },
      teardown: () => {
        connection.close()
      },
    }
  },
  sample: (seed: number) => newRecurrence({ startDate: isoDate(`2026-0${(seed % 9) + 1}-10`) }),
  mutate: (stored: Recurrence) => ({ ...stored, endsOn: isoDate('2026-12-10') }),
  idOf: (stored: Recurrence) => stored.id,
  missingId: () => asId<RecurrenceId>('does-not-exist'),
})

// Medido em 2026-10-01: a Descrição digitada no Novo Lançamento chegava ao
// template da série (o Zod e o domínio já a tipavam) e sumia ao gravar —
// `recurrences` não tinha coluna para ela. As 4 previsões de recorrente de
// outubro chegaram ao DRE sem texto.
describe('Recurrence repository — Descrição da série (2026-10-01)', () => {
  it('guarda e devolve a descrição do template, e a troca no replace', async () => {
    const { db, connection } = createInMemoryDatabase()
    connection.prepare('insert into users (id, created_at) values (?, ?)').run(USER_A, '2026-01-01')
    seedUser(db, USER_A)
    const repo = createRecurrenceRepository(db)
    const base = newRecurrence()
    const created = await repo.writer.create(USER_A, {
      ...base,
      template: { ...base.template, description: 'Aluguel sintético' },
    })
    expect((await repo.reader.findById(USER_A, created.id))?.template.description).toBe(
      'Aluguel sintético',
    )
    await repo.writer.replace(USER_A, {
      ...created,
      template: { ...created.template, description: 'Outra descrição' },
    })
    expect((await repo.reader.findById(USER_A, created.id))?.template.description).toBe(
      'Outra descrição',
    )
    connection.close()
  })
})

describe('Occurrence repository — sqlite', () => {
  function harness() {
    const { db, connection } = createInMemoryDatabase()
    connection.prepare('insert into users (id, created_at) values (?, ?)').run(USER_A, '2026-01-01')
    connection.prepare('insert into users (id, created_at) values (?, ?)').run(USER_B, '2026-01-01')
    seedUser(db, USER_A)
    seedUser(db, USER_B)
    const recurrenceRepo = createRecurrenceRepository(db)
    const occurrenceRepo = createOccurrenceRepository(db)
    return { db, connection, recurrenceRepo, occurrenceRepo }
  }

  function occurrenceOf(
    recurrenceId: RecurrenceId,
    monthValue = '2026-07',
  ): Omit<Occurrence, 'id'> {
    return {
      recurrenceId,
      month: month(monthValue),
      plannedDate: isoDate(`${monthValue}-10`),
      plannedAmount: cents(150_000),
      status: 'Planned',
      discarded: false,
      entryId: null,
    }
  }

  it('derives the id from (recurrenceId, month) — never a random one', async () => {
    const { connection, recurrenceRepo, occurrenceRepo } = harness()
    const recurrence = await recurrenceRepo.writer.create(USER_A, newRecurrence())

    const created = await occurrenceRepo.writer.create(USER_A, occurrenceOf(recurrence.id))
    expect(created.id).toBe(occurrenceIdFor(recurrence.id, month('2026-07')))
    connection.close()
  })

  it('materialising the same (série, mês) twice is a no-op — it does NOT overwrite an existing edit', async () => {
    const { connection, recurrenceRepo, occurrenceRepo } = harness()
    const recurrence = await recurrenceRepo.writer.create(USER_A, newRecurrence())

    const first = await occurrenceRepo.writer.create(USER_A, occurrenceOf(recurrence.id))
    // Simulate the person having already edited this occurrence's value.
    await occurrenceRepo.writer.replace(USER_A, { ...first, plannedAmount: cents(999) })

    // The Revisão de Recorrentes screen re-materialises the month on every
    // visit, proposing the ORIGINAL template amount again.
    const rematerialised = await occurrenceRepo.writer.create(USER_A, occurrenceOf(recurrence.id))

    expect(rematerialised.id).toBe(first.id)
    expect(rematerialised.plannedAmount).toBe(999)
    connection.close()
  })

  it('INVERSION CHECK — without onConflictDoNothing this test fails: create would silently reset a Paga occurrence back to Previsto', async () => {
    const { db, connection, recurrenceRepo, occurrenceRepo } = harness()
    const recurrence = await recurrenceRepo.writer.create(USER_A, newRecurrence())
    const created = await occurrenceRepo.writer.create(USER_A, occurrenceOf(recurrence.id))
    db.insert(entries)
      .values({
        userId: USER_A,
        id: 'entry-1',
        kind: 'Expense',
        amount: 150_000,
        date: '2026-07-10',
        status: 'Paid',
        entity: 'PF',
        categoryId: CATEGORY_ID,
        classification: 'Current',
        bankAccountId: PF_ACCOUNT_ID,
      })
      .run()
    const paid = await occurrenceRepo.writer.replace(USER_A, {
      ...created,
      status: 'Paid',
      entryId: asId<EntryId>('entry-1'),
    })

    const rematerialised = await occurrenceRepo.writer.create(USER_A, occurrenceOf(recurrence.id))
    expect(rematerialised.status).toBe('Paid')
    expect(rematerialised.entryId).toBe(paid.entryId)
    connection.close()
  })

  it("ADR-0008 §3 — never returns another user's occurrence, by id or by month", async () => {
    const { connection, recurrenceRepo, occurrenceRepo } = harness()
    const mine = await recurrenceRepo.writer.create(USER_A, newRecurrence())
    const theirs = await recurrenceRepo.writer.create(USER_B, newRecurrence())
    const myOccurrence = await occurrenceRepo.writer.create(USER_A, occurrenceOf(mine.id))
    await occurrenceRepo.writer.create(USER_B, occurrenceOf(theirs.id))

    expect(await occurrenceRepo.reader.findById(USER_B, myOccurrence.id)).toBeNull()
    expect(await occurrenceRepo.reader.listByMonth(USER_A, month('2026-07'))).toEqual([
      myOccurrence,
    ])
    connection.close()
  })

  it('replace persists a change and refuses an occurrence that does not belong to this user', async () => {
    const { connection, recurrenceRepo, occurrenceRepo } = harness()
    const recurrence = await recurrenceRepo.writer.create(USER_A, newRecurrence())
    const created = await occurrenceRepo.writer.create(USER_A, occurrenceOf(recurrence.id))
    const edited = { ...created, plannedAmount: cents(200_000) }

    await occurrenceRepo.writer.replace(USER_A, edited)
    expect(await occurrenceRepo.reader.findById(USER_A, created.id)).toEqual(edited)

    await expect(occurrenceRepo.writer.replace(USER_B, edited)).rejects.toThrow(
      'occurrence.unknown_occurrence',
    )
    connection.close()
  })

  it('replaceMany writes every occurrence in one transaction ("valores em aberto")', async () => {
    const { connection, recurrenceRepo, occurrenceRepo } = harness()
    const recurrence = await recurrenceRepo.writer.create(USER_A, newRecurrence())
    const july = await occurrenceRepo.writer.create(USER_A, occurrenceOf(recurrence.id, '2026-07'))
    const august = await occurrenceRepo.writer.create(
      USER_A,
      occurrenceOf(recurrence.id, '2026-08'),
    )

    const updated = await occurrenceRepo.writer.replaceMany(USER_A, [
      { ...july, plannedAmount: cents(160_000) },
      { ...august, plannedAmount: cents(160_000) },
    ])

    expect(updated).toHaveLength(2)
    expect((await occurrenceRepo.reader.findById(USER_A, july.id))?.plannedAmount).toBe(160_000)
    expect((await occurrenceRepo.reader.findById(USER_A, august.id))?.plannedAmount).toBe(160_000)
    connection.close()
  })

  it("replaceMany rolls back entirely when one occurrence in the batch is not this user's", async () => {
    const { connection, recurrenceRepo, occurrenceRepo } = harness()
    const mine = await recurrenceRepo.writer.create(USER_A, newRecurrence())
    const theirs = await recurrenceRepo.writer.create(USER_B, newRecurrence())
    const myOccurrence = await occurrenceRepo.writer.create(
      USER_A,
      occurrenceOf(mine.id, '2026-07'),
    )
    const theirOccurrence = await occurrenceRepo.writer.create(
      USER_B,
      occurrenceOf(theirs.id, '2026-07'),
    )

    await expect(
      occurrenceRepo.writer.replaceMany(USER_A, [
        { ...myOccurrence, plannedAmount: cents(1) },
        { ...theirOccurrence, plannedAmount: cents(1) },
      ]),
    ).rejects.toThrow('occurrence.unknown_occurrence')

    // The first item's write did not survive the failed second one.
    expect((await occurrenceRepo.reader.findById(USER_A, myOccurrence.id))?.plannedAmount).toBe(
      150_000,
    )
    connection.close()
  })

  it('listByRecurrence and listOpenByRecurrence — the latter excludes Paga and Descartada', async () => {
    const { connection, recurrenceRepo, occurrenceRepo } = harness()
    const recurrence = await recurrenceRepo.writer.create(USER_A, newRecurrence())
    const july = await occurrenceRepo.writer.create(USER_A, occurrenceOf(recurrence.id, '2026-07'))
    const august = await occurrenceRepo.writer.create(
      USER_A,
      occurrenceOf(recurrence.id, '2026-08'),
    )
    await occurrenceRepo.writer.replace(USER_A, { ...august, discarded: true })
    const september = await occurrenceRepo.writer.create(
      USER_A,
      occurrenceOf(recurrence.id, '2026-09'),
    )

    const all = await occurrenceRepo.reader.listByRecurrence(USER_A, recurrence.id)
    expect(all.map((o) => o.month)).toEqual(['2026-07', '2026-08', '2026-09'])

    const open = await occurrenceRepo.reader.listOpenByRecurrence(USER_A, recurrence.id)
    expect(open.map((o) => o.id)).toEqual([july.id, september.id])
    connection.close()
  })

  it('answers null/empty for an occurrence that does not exist, instead of throwing', async () => {
    const { connection, occurrenceRepo } = harness()
    expect(await occurrenceRepo.reader.findById(USER_A, asId<OccurrenceId>('none'))).toBeNull()
    expect(await occurrenceRepo.reader.listByMonth(USER_A, month('2026-01'))).toEqual([])
    connection.close()
  })

  it('2026-10-01 — a ocorrência guarda a própria descrição ("só esta ocorrência"), e null quando não tem', async () => {
    const { recurrenceRepo, occurrenceRepo } = harness()
    const recurrence = await recurrenceRepo.writer.create(USER_A, newRecurrence())
    const created = await occurrenceRepo.writer.create(USER_A, occurrenceOf(recurrence.id))
    expect(created.description ?? null).toBeNull()
    await occurrenceRepo.writer.replace(USER_A, { ...created, description: 'Só outubro' })
    expect((await occurrenceRepo.reader.findById(USER_A, created.id))?.description).toBe(
      'Só outubro',
    )
  })
})
