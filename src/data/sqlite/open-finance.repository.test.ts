/**
 * Open Finance — SQLite adapter tests (ADR-0020).
 *
 * The generic CRUD contract does not fit these ports (none of them has
 * `findById`/`list`/`count`), so this suite covers the same invariants by
 * hand: user scope, replace-on-save, and the two behaviours the import leans
 * on — a transaction id is remembered forever, and a discarded Lançamento
 * drops out of the unpaid card purchases instead of blocking the discard.
 */

import type BetterSqlite3 from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { asId, cents, isoDate, type BankAccountId, type EntryId } from '@/domain/core'
import type { ProviderAccountId, ProviderTransactionId } from '@/domain/open-finance'
import type { UserId } from '@/data/contracts/common'
import { createBankAccountRepository } from './bank-accounts.repository'
import { createEntryRepository } from './entries.repository'
import { createInMemoryDatabase, type BigornaDatabase } from './client'
import { createOpenFinanceRepositories } from './open-finance.repository'
import { DEFAULT_BLOCKS, DEFAULT_CATEGORIES } from '@/domain/chart-of-accounts'
import {
  createCategoryRepository,
  createStatementBlockRepository,
} from './chart-of-accounts.repository'

const USER_A = 'user-a' as UserId
const USER_B = 'user-b' as UserId
const CARD = 'prov-cartao' as ProviderAccountId

function seedUser(connection: BetterSqlite3.Database, id: UserId): void {
  connection.prepare('insert into users (id, created_at) values (?, ?)').run(id, '2026-01-01')
}

describe('open-finance.repository (sqlite)', () => {
  let db: BigornaDatabase
  let connection: BetterSqlite3.Database
  let accountId: BankAccountId

  beforeEach(async () => {
    ;({ db, connection } = createInMemoryDatabase())
    seedUser(connection, USER_A)
    seedUser(connection, USER_B)
    await createStatementBlockRepository(db).writer.seed(USER_A, DEFAULT_BLOCKS)
    await createCategoryRepository(db).writer.seed(USER_A, DEFAULT_CATEGORIES)
    const conta = await createBankAccountRepository(db).writer.create(USER_A, {
      label: 'Conta Sintética',
      colour: 'nubank',
      entity: 'PF',
      balance: cents(0),
    })
    accountId = conta.id
  })

  afterEach(() => connection.close())

  it('ADR-0008 §3 — o vínculo salvo por uma pessoa não aparece para outra, e salvar de novo substitui', async () => {
    const { links } = createOpenFinanceRepositories(db)
    const link = {
      providerAccountId: 'prov-1' as ProviderAccountId,
      target: { kind: 'BankAccount' as const, bankAccountId: accountId },
      linkedOn: isoDate('2026-09-01'),
    }
    await links.writer.save(USER_A, link)
    await links.writer.save(USER_A, { ...link, linkedOn: isoDate('2026-10-01') })

    expect(await links.reader.list(USER_A)).toEqual([{ ...link, linkedOn: '2026-10-01' }])
    expect(await links.reader.list(USER_B)).toEqual([])
  })

  it('ADR-0020 §3 — descartar a Conta Bancária leva o vínculo junto, sem 409', async () => {
    const { links } = createOpenFinanceRepositories(db)
    await links.writer.save(USER_A, {
      providerAccountId: 'prov-1' as ProviderAccountId,
      target: { kind: 'BankAccount', bankAccountId: accountId },
      linkedOn: isoDate('2026-09-01'),
    })
    await createBankAccountRepository(db).writer.remove(USER_A, accountId)
    expect(await links.reader.list(USER_A)).toEqual([])
  })

  it('PRD §5 — o id de uma transação importada fica registrado (idempotência)', async () => {
    const { imported } = createOpenFinanceRepositories(db)
    await imported.writer.record(USER_A, {
      transactionId: 'tx-1' as ProviderTransactionId,
      accountId: CARD,
      date: isoDate('2026-09-10'),
      amount: cents(1000),
      description: 'Descrição sintética',
      outcome: 'Ignored',
      entryId: null,
      settledOn: null,
    })
    expect([...(await imported.reader.listIds(USER_A))]).toEqual(['tx-1'])
    expect([...(await imported.reader.listIds(USER_B))]).toEqual([])
  })

  it('dono 2026-10-09 — "Vincular ao banco": o registro passa a apontar para o lançamento da pessoa', async () => {
    const { imported } = createOpenFinanceRepositories(db)
    const base = {
      accountId: CARD,
      date: isoDate('2026-10-05'),
      amount: cents(1000),
      description: 'Descrição sintética',
      outcome: 'Entry' as const,
      settledOn: null,
    }
    await imported.writer.record(USER_A, {
      ...base,
      transactionId: 'tx-dep' as ProviderTransactionId,
      entryId: 'duplicado' as EntryId,
    })
    await imported.writer.record(USER_B, {
      ...base,
      transactionId: 'tx-dep' as ProviderTransactionId,
      entryId: 'de-outra-pessoa' as EntryId,
    })

    await imported.writer.relink(USER_A, 'tx-dep' as ProviderTransactionId, 'manual' as EntryId)

    const [registro] = await imported.reader.listRecords(USER_A)
    expect(registro).toMatchObject({
      entryId: 'manual',
      outcome: 'PayPlanned',
      categorizedByPerson: true,
    })
    const [outra] = await imported.reader.listRecords(USER_B)
    expect(outra?.entryId).toBe('de-outra-pessoa')
  })

  it('PRD §5 — compra de cartão liquidada ou com lançamento descartado sai da lista de não pagas', async () => {
    const { imported } = createOpenFinanceRepositories(db)
    const entries = createEntryRepository(db)
    async function compra(id: string, date: string) {
      const entry = await entries.writer.create(USER_A, {
        kind: 'Expense',
        amount: cents(1000),
        date: isoDate(date),
        status: 'Planned',
        recurrenceId: null,
        entity: 'PF',
        categoryId: asId('alimentacao'),
        classification: 'Current',
        bankAccountId: accountId,
      })
      await imported.writer.record(USER_A, {
        transactionId: id as ProviderTransactionId,
        accountId: CARD,
        date: isoDate(date),
        amount: cents(1000),
        description: 'Compra sintética',
        outcome: 'CardPurchase',
        entryId: entry.id,
        settledOn: null,
      })
      return entry.id
    }
    const aberta = await compra('tx-aberta', '2026-09-03')
    const liquidada = await compra('tx-liquidada', '2026-09-02')
    const descartada = await compra('tx-descartada', '2026-09-01')

    await imported.writer.markSettled(USER_A, [liquidada], isoDate('2026-09-20'))
    await entries.writer.remove(USER_A, descartada as EntryId)

    expect(await imported.reader.listUnpaidCardPurchases(USER_A)).toEqual([
      {
        entryId: aberta,
        transactionId: 'tx-aberta',
        cardAccountId: CARD,
        date: '2026-09-03',
        entryDate: '2026-09-03',
        amount: 1000,
        billId: null,
        pending: false,
      },
    ])
  })

  it('PRD §5 — a compra PENDING é seguida pelo id: quando a fatura fecha, o registro troca de id, valor e fatura e mantém a categoria da pessoa', async () => {
    const { imported } = createOpenFinanceRepositories(db)
    const entry = await createEntryRepository(db).writer.create(USER_A, {
      kind: 'Expense',
      amount: cents(8000),
      date: isoDate('2026-09-30'),
      status: 'Planned',
      recurrenceId: null,
      entity: 'PF',
      categoryId: asId('alimentacao'),
      classification: 'Current',
      bankAccountId: accountId,
    })
    await imported.writer.record(USER_A, {
      transactionId: 'tx-pendente' as ProviderTransactionId,
      accountId: CARD,
      date: isoDate('2026-09-30'),
      amount: cents(8000),
      description: 'Compra sintética',
      outcome: 'CardPurchase',
      entryId: entry.id,
      settledOn: null,
      pending: true,
    })
    await imported.writer.markCategorizedByPerson(USER_A, entry.id)
    expect((await imported.reader.listUnpaidCardPurchases(USER_A))[0]?.pending).toBe(true)

    await imported.writer.followCardPurchase(USER_A, 'tx-pendente' as ProviderTransactionId, {
      transactionId: 'tx-lancada' as ProviderTransactionId,
      date: isoDate('2026-09-30'),
      amount: cents(7990),
      description: 'Compra sintética lançada',
      billId: 'fatura-out',
      providerCategory: null,
      pending: false,
    })

    const [record] = await imported.reader.listRecords(USER_A)
    expect(record).toMatchObject({
      transactionId: 'tx-lancada',
      amount: 7990,
      billId: 'fatura-out',
      pending: false,
      entryId: entry.id,
      categorizedByPerson: true,
    })
    expect(await imported.reader.listIds(USER_A)).toEqual(new Set(['tx-lancada']))
  })

  it('ADR-0008 §3 — seguir a compra de uma pessoa não toca o registro de outra com o mesmo id', async () => {
    const { imported } = createOpenFinanceRepositories(db)
    const base = {
      transactionId: 'tx-mesmo-id' as ProviderTransactionId,
      accountId: CARD,
      date: isoDate('2026-09-30'),
      amount: cents(100),
      description: 'Compra sintética',
      outcome: 'CardPurchase' as const,
      entryId: null,
      settledOn: null,
      pending: true,
    }
    await imported.writer.record(USER_A, base)
    await imported.writer.record(USER_B, base)
    await imported.writer.followCardPurchase(USER_A, base.transactionId, {
      transactionId: base.transactionId,
      date: base.date,
      amount: cents(200),
      description: base.description,
      billId: null,
      providerCategory: null,
      pending: true,
    })
    expect((await imported.reader.listRecords(USER_B))[0]?.amount).toBe(100)
  })

  it('guarda o instante da última sincronização por pessoa', async () => {
    const { syncState } = createOpenFinanceRepositories(db)
    expect(await syncState.reader.lastSyncedAt(USER_A)).toBeNull()
    await syncState.writer.markSynced(USER_A, '2026-09-29T10:00:00.000Z')
    await syncState.writer.markSynced(USER_A, '2026-09-29T16:00:00.000Z')
    expect(await syncState.reader.lastSyncedAt(USER_A)).toBe('2026-09-29T16:00:00.000Z')
    expect(await syncState.reader.lastSyncedAt(USER_B)).toBeNull()
  })

  it('a sincronização automática nasce ligada, desliga e religa por pessoa (2026-10-01)', async () => {
    const { syncState } = createOpenFinanceRepositories(db)
    expect(await syncState.reader.autoSyncEnabled(USER_A)).toBe(true)
    await syncState.writer.setAutoSync(USER_A, false)
    expect(await syncState.reader.autoSyncEnabled(USER_A)).toBe(false)
    expect(await syncState.reader.autoSyncEnabled(USER_B)).toBe(true)
    await syncState.writer.setAutoSync(USER_A, true)
    expect(await syncState.reader.autoSyncEnabled(USER_A)).toBe(true)
  })
})
