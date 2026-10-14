/**
 * The contract suite for `EntryReader`/`EntryWriter` — the queries the reports
 * depend on, written against the port so every adapter answers them the same
 * way (SOLID/LSP).
 *
 * `describeCrudContract` already covers store/read/replace/remove and the user
 * scope. What is here is what is SPECIFIC to the Lançamento, and each test names
 * the rule it protects, per CLAUDE.md §3.
 */

import { describe, expect, it } from 'vitest'
import type { BankAccountId, CategoryId } from '@/domain/core'
import { asId, cents, isoDate, month } from '@/domain/core'
import type { Entry, EntryFilter, NewEntry } from '@/domain/entries'
import type { EntryReader, EntryWriter } from './entries'
import type { UserId } from './common'

export interface EntryContractHarness {
  readonly reader: EntryReader
  readonly writer: EntryWriter
  /**
   * Seeds the rows an entry points at — the user, a category, two accounts —
   * and returns their ids. An adapter with real foreign keys cannot store an
   * entry without them, and an adapter without foreign keys must still pass the
   * same suite.
   */
  prepare(userId: UserId): Promise<{
    categoryId: CategoryId
    pfAccountId: BankAccountId
    pjAccountId: BankAccountId
  }>
  teardown?(): void | Promise<void>
}

export interface EntryContractSetup {
  readonly adapter: string
  create(): Promise<EntryContractHarness>
}

const USER_A = 'contract-user-a' as UserId
const USER_B = 'contract-user-b' as UserId

const NO_FILTER: EntryFilter = {
  status: null,
  view: null,
  month: null,
  categoryId: null,
  classification: null,
  bankAccountId: null,
  recurring: null,
}

export function describeEntryContract(setup: EntryContractSetup): void {
  describe(`Entry repository contract — ${setup.adapter}`, () => {
    function expense(
      categoryId: CategoryId,
      bankAccountId: BankAccountId,
      date: string,
      amount: number,
      status: 'Planned' | 'Paid' = 'Paid',
    ): NewEntry {
      return {
        kind: 'Expense',
        amount: cents(amount),
        date: isoDate(date),
        status,
        recurrenceId: null,
        entity: 'PF',
        categoryId,
        classification: 'Current',
        bankAccountId,
      }
    }

    it('PRD §5 — listByMonth uses the PAYMENT date, so the 1st stays in its own month', async () => {
      const h = await setup.create()
      const ids = await h.prepare(USER_A)

      const january = await h.writer.create(
        USER_A,
        expense(ids.categoryId, ids.pfAccountId, '2026-01-31', 1000),
      )
      const february = await h.writer.create(
        USER_A,
        expense(ids.categoryId, ids.pfAccountId, '2026-02-01', 2000),
      )

      // The bug this guards against is a stored timestamp read back in UTC-3,
      // which moves midnight of the 1st into the previous month.
      const januaryEntries = await h.reader.listByMonth(USER_A, month('2026-01'))
      const februaryEntries = await h.reader.listByMonth(USER_A, month('2026-02'))

      expect(januaryEntries.map((e) => e.id)).toEqual([january.id])
      expect(februaryEntries.map((e) => e.id)).toEqual([february.id])
      await h.teardown?.()
    })

    it('ADR-0021 — "Cartão de crédito" e "Contabilizar em" voltam como foram gravados', async () => {
      const h = await setup.create()
      const ids = await h.prepare(USER_A)
      const stored = await h.writer.create(USER_A, {
        ...expense(ids.categoryId, ids.pfAccountId, '2026-10-15', 1000),
        isCreditCard: true,
        accountingMonth: month('2026-09'),
      } as NewEntry)

      const read = await h.reader.findById(USER_A, stored.id)
      expect(read).toMatchObject({ isCreditCard: true, accountingMonth: '2026-09' })
      await h.teardown?.()
    })

    it('ADR-0021 — listByMonth e search usam o "Contabilizar em" no lugar do mês do pagamento', async () => {
      const h = await setup.create()
      const ids = await h.prepare(USER_A)
      const moved = await h.writer.create(USER_A, {
        ...expense(ids.categoryId, ids.pfAccountId, '2026-10-15', 1000),
        accountingMonth: month('2026-09'),
      } as NewEntry)
      const stays = await h.writer.create(
        USER_A,
        expense(ids.categoryId, ids.pfAccountId, '2026-10-16', 2000),
      )

      const september = await h.reader.listByMonth(USER_A, month('2026-09'))
      const october = await h.reader.listByMonth(USER_A, month('2026-10'))
      expect(september.map((e) => e.id)).toEqual([moved.id])
      expect(october.map((e) => e.id)).toEqual([stays.id])

      const searched = await h.reader.search(USER_A, { ...NO_FILTER, month: month('2026-09') })
      expect(searched.items.map((e) => e.id)).toEqual([moved.id])
      await h.teardown?.()
    })

    it("ADR-0008 §3 — listByMonth never crosses into another user's month", async () => {
      const h = await setup.create()
      const mine = await h.prepare(USER_A)
      const theirs = await h.prepare(USER_B)

      await h.writer.create(USER_A, expense(mine.categoryId, mine.pfAccountId, '2026-03-10', 500))
      await h.writer.create(
        USER_B,
        expense(theirs.categoryId, theirs.pfAccountId, '2026-03-10', 700),
      )

      const forA = await h.reader.listByMonth(USER_A, month('2026-03'))
      expect(forA).toHaveLength(1)
      expect(forA[0]?.amount).toBe(500)
      await h.teardown?.()
    })

    it('files_design/03 — a null filter is NOT applied, it does not mean "match null"', async () => {
      const h = await setup.create()
      const ids = await h.prepare(USER_A)
      await h.writer.create(USER_A, expense(ids.categoryId, ids.pfAccountId, '2026-04-02', 100))
      await h.writer.create(
        USER_A,
        expense(ids.categoryId, ids.pfAccountId, '2026-04-03', 200, 'Planned'),
      )

      const all = await h.reader.search(USER_A, NO_FILTER)
      expect(all.total).toBe(2)
      expect(all.items).toHaveLength(2)
      await h.teardown?.()
    })

    it('files_design/03 — search filters by status, month, category and account', async () => {
      const h = await setup.create()
      const ids = await h.prepare(USER_A)
      const paid = await h.writer.create(
        USER_A,
        expense(ids.categoryId, ids.pfAccountId, '2026-05-10', 1500),
      )
      await h.writer.create(
        USER_A,
        expense(ids.categoryId, ids.pfAccountId, '2026-05-11', 900, 'Planned'),
      )
      await h.writer.create(USER_A, expense(ids.categoryId, ids.pfAccountId, '2026-06-01', 400))

      const found = await h.reader.search(USER_A, {
        ...NO_FILTER,
        status: 'Paid',
        month: month('2026-05'),
        categoryId: ids.categoryId,
        bankAccountId: ids.pfAccountId,
      })

      expect(found.items.map((e) => e.id)).toEqual([paid.id])
      expect(found.total).toBe(1)
      await h.teardown?.()
    })

    it('reports the total BEFORE the page window, so a caller can page', async () => {
      const h = await setup.create()
      const ids = await h.prepare(USER_A)
      for (let day = 1; day <= 5; day += 1) {
        const date = `2026-07-0${day}`
        await h.writer.create(USER_A, expense(ids.categoryId, ids.pfAccountId, date, day * 100))
      }

      const page = await h.reader.search(USER_A, NO_FILTER, { limit: 2, offset: 0 })
      expect(page.items).toHaveLength(2)
      expect(page.total).toBe(5)
      await h.teardown?.()
    })

    it('files_design/03 — the "recorrente" filter tells a series entry from a one-off', async () => {
      const h = await setup.create()
      const ids = await h.prepare(USER_A)
      await h.writer.create(USER_A, expense(ids.categoryId, ids.pfAccountId, '2026-08-01', 100))

      const oneOff = await h.reader.search(USER_A, { ...NO_FILTER, recurring: false })
      expect(oneOff.total).toBe(1)

      const fromSeries = await h.reader.search(USER_A, { ...NO_FILTER, recurring: true })
      expect(fromSeries.total).toBe(0)
      await h.teardown?.()
    })

    it('keeps money as an integer of cents through a round trip (ADR-0001 §5)', async () => {
      const h = await setup.create()
      const ids = await h.prepare(USER_A)
      const stored = await h.writer.create(
        USER_A,
        expense(ids.categoryId, ids.pfAccountId, '2026-09-15', 152_000),
      )
      const read = await h.reader.findById(USER_A, stored.id)

      expect(read?.amount).toBe(152_000)
      expect(Number.isInteger(read?.amount)).toBe(true)
      await h.teardown?.()
    })

    it('preserves the kind-specific fields of a pró-labore (PJ → PF)', async () => {
      const h = await setup.create()
      const ids = await h.prepare(USER_A)
      const proLabore: NewEntry = {
        kind: 'ProLabore',
        amount: cents(800_000),
        date: isoDate('2026-10-05'),
        status: 'Paid',
        recurrenceId: null,
        sourceAccountId: ids.pjAccountId,
        destinationAccountId: ids.pfAccountId,
      }
      const stored = await h.writer.create(USER_A, proLabore)
      const read = (await h.reader.findById(USER_A, stored.id)) as Entry

      expect(read.kind).toBe('ProLabore')
      expect(read).toMatchObject({
        sourceAccountId: ids.pjAccountId,
        destinationAccountId: ids.pfAccountId,
      })
      // A pró-labore has no entity and no category — the union says so, and a
      // round trip through a flat table must not invent them.
      expect('entity' in read).toBe(false)
      expect('categoryId' in read).toBe(false)
      await h.teardown?.()
    })

    it('finds nothing for a recurrence that produced no entry', async () => {
      const h = await setup.create()
      await h.prepare(USER_A)
      expect(await h.reader.listByRecurrence(USER_A, asId('unknown-series'))).toEqual([])
      await h.teardown?.()
    })

    /**
     * The task instructions ask for a round trip domain -> row -> domain FOR
     * EACH kind of Lançamento (5 kinds, types.ts). Only 'Expense' (money) and
     * 'ProLabore' (kind-specific fields) had a test before this one — the
     * three remaining kinds went through the flat table untested, and a
     * discriminated union collapsed onto one row is exactly where a column
     * could silently leak or a required field could silently disappear.
     */
    it('preserves the kind-specific fields of a receita (Entity + Categoria + Classificação)', async () => {
      const h = await setup.create()
      const ids = await h.prepare(USER_A)
      const revenue: NewEntry = {
        kind: 'Revenue',
        amount: cents(500_000),
        date: isoDate('2026-11-05'),
        status: 'Paid',
        recurrenceId: null,
        entity: 'PJ',
        categoryId: ids.categoryId,
        classification: 'Current',
        bankAccountId: ids.pjAccountId,
      }
      const stored = await h.writer.create(USER_A, revenue)
      const read = (await h.reader.findById(USER_A, stored.id)) as Entry

      expect(read.kind).toBe('Revenue')
      expect(read).toMatchObject({
        entity: 'PJ',
        categoryId: ids.categoryId,
        classification: 'Current',
        bankAccountId: ids.pjAccountId,
      })
      await h.teardown?.()
    })

    it('preserves the kind-specific fields of a distribuição de lucro (PJ → PF, below the line)', async () => {
      const h = await setup.create()
      const ids = await h.prepare(USER_A)
      const distribution: NewEntry = {
        kind: 'ProfitDistribution',
        amount: cents(300_000),
        date: isoDate('2026-12-01'),
        status: 'Paid',
        recurrenceId: null,
        sourceAccountId: ids.pjAccountId,
        destinationAccountId: ids.pfAccountId,
      }
      const stored = await h.writer.create(USER_A, distribution)
      const read = (await h.reader.findById(USER_A, stored.id)) as Entry

      expect(read.kind).toBe('ProfitDistribution')
      expect(read).toMatchObject({
        sourceAccountId: ids.pjAccountId,
        destinationAccountId: ids.pfAccountId,
      })
      // Same union guarantee as the pró-labore test: no entity, no categoria.
      expect('entity' in read).toBe(false)
      expect('categoryId' in read).toBe(false)
      await h.teardown?.()
    })

    it('preserves the kind-specific fields of an IR (direction + Rótulo opcional, no categoria)', async () => {
      const h = await setup.create()
      const ids = await h.prepare(USER_A)
      const incomeTax: NewEntry = {
        kind: 'IncomeTax',
        amount: cents(120_000),
        date: isoDate('2026-04-30'),
        status: 'Paid',
        recurrenceId: null,
        direction: 'Payment',
        entity: 'PF',
        bankAccountId: ids.pfAccountId,
        label: 'IRPF ajuste anual',
      }
      const stored = await h.writer.create(USER_A, incomeTax)
      const read = (await h.reader.findById(USER_A, stored.id)) as Entry

      expect(read.kind).toBe('IncomeTax')
      expect(read).toMatchObject({
        direction: 'Payment',
        entity: 'PF',
        bankAccountId: ids.pfAccountId,
        label: 'IRPF ajuste anual',
      })
      expect('categoryId' in read).toBe(false)
      await h.teardown?.()
    })

    it('files_design/03 — IR Rótulo is the one exception field: it round-trips as null, not empty string', async () => {
      const h = await setup.create()
      const ids = await h.prepare(USER_A)
      const incomeTax: NewEntry = {
        kind: 'IncomeTax',
        amount: cents(50_000),
        date: isoDate('2026-05-30'),
        status: 'Paid',
        recurrenceId: null,
        direction: 'Refund',
        entity: 'PF',
        bankAccountId: ids.pfAccountId,
        label: null,
      }
      const stored = await h.writer.create(USER_A, incomeTax)
      const read = (await h.reader.findById(USER_A, stored.id)) as Entry

      expect(read.kind).toBe('IncomeTax')
      expect((read as { label: string | null }).label).toBeNull()
      await h.teardown?.()
    })
  })
}
