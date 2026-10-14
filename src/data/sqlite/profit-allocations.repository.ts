/**
 * Destinar o Lucro — the SQLite adapter for
 * `src/data/contracts/profit-allocations.ts`.
 *
 * Two tables back one aggregate (schema.ts): `profit_allocations` holds the
 * month and the captured Lucro Líquido, `allocation_items` holds the lines of
 * the four cards. `save` replaces the item list WHOLESALE — deletes every row
 * of the month and re-inserts what the screen submitted — because the port
 * contract says so explicitly: "an item removed from a card must disappear
 * rather than survive as an orphan" (data/contracts/profit-allocations.ts).
 */

import { and, asc, eq, inArray } from 'drizzle-orm'

import { ALLOCATION_BUCKETS } from '@/domain/profit-allocation'
import type {
  AllocationBucket,
  AllocationDestination,
  AllocationItem,
  ProfitAllocation,
} from '@/domain/profit-allocation'
import { asId, cents, type BankAccountId, type InvestmentId, type Month } from '@/domain/core'
import type {
  ProfitAllocationReader,
  ProfitAllocationWriter,
} from '@/data/contracts/profit-allocations'
import type { UserId } from '@/data/contracts/common'
import type { BigornaDatabase } from './client'
import { isForeignKeyViolation } from './constraint-errors'
import { allocationItems, profitAllocations } from './schema'

/**
 * An item whose destino names an Investimento or uma Conta Bancária that does
 * not exist for THIS user trips a composite foreign key of `schema.ts`. The
 * request named something absent — the 404 rule of `src/api/http.ts` — not a
 * broken store, so it is translated here instead of reaching `handler()` as an
 * unclassified 500, exactly as `entries.repository.ts` does for
 * `entries.unknown_reference`.
 */
function translateReference(error: unknown): unknown {
  return isForeignKeyViolation(error) ? new Error('profit_allocation.unknown_reference') : error
}

type AllocationItemRow = typeof allocationItems.$inferSelect

function toDestination(row: AllocationItemRow): AllocationDestination | null {
  switch (row.destinationKind) {
    case null:
      return null
    case 'Investment':
      // `allocation_items_destination_shape` (schema.ts) guarantees the paired
      // column is set whenever `destinationKind` says so.
      return { kind: 'Investment', investmentId: asId<InvestmentId>(row.destinationInvestmentId!) }
    case 'BankAccount':
      return {
        kind: 'BankAccount',
        bankAccountId: asId<BankAccountId>(row.destinationBankAccountId!),
      }
    case 'FreeText':
      return { kind: 'FreeText', name: row.destinationName! }
  }
}

function toItem(row: AllocationItemRow): AllocationItem {
  return { destination: toDestination(row), amount: cents(row.amount) }
}

function destinationColumns(destination: AllocationDestination | null): {
  destinationKind: AllocationDestination['kind'] | null
  destinationInvestmentId: string | null
  destinationBankAccountId: string | null
  destinationName: string | null
} {
  if (destination === null) {
    return {
      destinationKind: null,
      destinationInvestmentId: null,
      destinationBankAccountId: null,
      destinationName: null,
    }
  }
  return {
    destinationKind: destination.kind,
    destinationInvestmentId: destination.kind === 'Investment' ? destination.investmentId : null,
    destinationBankAccountId: destination.kind === 'BankAccount' ? destination.bankAccountId : null,
    destinationName: destination.kind === 'FreeText' ? destination.name : null,
  }
}

/** Groups a month's item rows by bucket, in stored position order, every bucket present. */
function groupByBucket(
  rows: readonly AllocationItemRow[],
): Record<AllocationBucket, AllocationItem[]> {
  const grouped: Record<AllocationBucket, AllocationItem[]> = {
    InvestmentContribution: [],
    DividendReinvestment: [],
    ExtraordinaryConsumption: [],
    CashReserve: [],
  }
  for (const row of rows) {
    grouped[row.bucket].push(toItem(row))
  }
  return grouped
}

async function loadItems(
  db: BigornaDatabase,
  userId: UserId,
  months: readonly Month[],
): Promise<Map<Month, Record<AllocationBucket, AllocationItem[]>>> {
  if (months.length === 0) return new Map()
  const rows = db
    .select()
    .from(allocationItems)
    .where(and(eq(allocationItems.userId, userId), inArray(allocationItems.month, months)))
    .orderBy(asc(allocationItems.month), asc(allocationItems.bucket), asc(allocationItems.position))
    .all()

  const byMonth = new Map<Month, AllocationItemRow[]>()
  for (const row of rows) {
    const month = row.month as Month
    const list = byMonth.get(month) ?? []
    list.push(row)
    byMonth.set(month, list)
  }
  return new Map(months.map((month) => [month, groupByBucket(byMonth.get(month) ?? [])]))
}

export function createProfitAllocationRepository(db: BigornaDatabase): {
  reader: ProfitAllocationReader
  writer: ProfitAllocationWriter
} {
  const reader: ProfitAllocationReader = {
    async findByMonth(userId: UserId, month: Month) {
      const row = db
        .select()
        .from(profitAllocations)
        .where(and(eq(profitAllocations.userId, userId), eq(profitAllocations.month, month)))
        .get()
      if (row === undefined) return null

      const itemsByMonth = await loadItems(db, userId, [month])
      return { month, netProfit: cents(row.netProfit), items: itemsByMonth.get(month)! }
    },

    async listAll(userId: UserId) {
      const rows = db
        .select()
        .from(profitAllocations)
        .where(eq(profitAllocations.userId, userId))
        .orderBy(asc(profitAllocations.month))
        .all()
      const itemsByMonth = await loadItems(
        db,
        userId,
        rows.map((row) => row.month as Month),
      )
      return rows.map((row) => ({
        month: row.month as Month,
        netProfit: cents(row.netProfit),
        items: itemsByMonth.get(row.month as Month)!,
      }))
    },

    async listByMonths(userId: UserId, months: readonly Month[]) {
      if (months.length === 0) return []
      const rows = db
        .select()
        .from(profitAllocations)
        .where(and(eq(profitAllocations.userId, userId), inArray(profitAllocations.month, months)))
        .all()
      const itemsByMonth = await loadItems(
        db,
        userId,
        rows.map((row) => row.month as Month),
      )
      return rows.map((row) => ({
        month: row.month as Month,
        netProfit: cents(row.netProfit),
        items: itemsByMonth.get(row.month as Month)!,
      }))
    },
  }

  const writer: ProfitAllocationWriter = {
    // One allocation per month (the month IS the identity, data/contracts/
    // profit-allocations.ts) — upsert the header, then replace every item row
    // of the month wholesale, in one transaction so a reader never observes the
    // old items alongside the new header.
    async save(userId: UserId, allocation: ProfitAllocation) {
      try {
        db.transaction((tx) => {
          tx.insert(profitAllocations)
            .values({ userId, month: allocation.month, netProfit: allocation.netProfit })
            .onConflictDoUpdate({
              target: [profitAllocations.userId, profitAllocations.month],
              set: { netProfit: allocation.netProfit },
            })
            .run()

          tx.delete(allocationItems)
            .where(
              and(eq(allocationItems.userId, userId), eq(allocationItems.month, allocation.month)),
            )
            .run()

          for (const bucket of ALLOCATION_BUCKETS) {
            allocation.items[bucket].forEach((item, position) => {
              tx.insert(allocationItems)
                .values({
                  userId,
                  id: `${allocation.month}:${bucket}:${position}`,
                  month: allocation.month,
                  bucket,
                  position,
                  amount: item.amount,
                  ...destinationColumns(item.destination),
                })
                .run()
            })
          }
        })
      } catch (error) {
        throw translateReference(error)
      }

      return allocation
    },
  }

  return { reader, writer }
}
