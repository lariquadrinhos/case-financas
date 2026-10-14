/**
 * `GET, PUT /api/v1/profit-allocations/{month}` — Destinar o Lucro
 * (files_design/01 §9, PRD UC6).
 *
 * Addressed by MONTH: there is exactly one allocation per month, so `PUT` is
 * an idempotent upsert, not a create. Business rules stay in
 * `src/domain/profit-allocation` — this file only computes the ONE input the
 * domain cannot invent for itself (the Lucro Líquido, via the DRE) and folds
 * every submitted item through `addItem`, which is what already enforces
 * "destino compatível com o balde" and "soma não excede o lucro líquido"
 * (rules.ts) — re-checking those rules here would be the second copy of a
 * business rule this codebase's SRP forbids.
 */

import {
  ALLOCATION_BUCKETS,
  addItem,
  canAllocate,
  emptyAllocation,
  unallocatedBalance,
  type AllocationBucket,
  type AllocationDestination,
  type ProfitAllocation,
} from '@/domain/profit-allocation'
import { computeIncomeStatement } from '@/domain/reports'
import { asId, cents, month, type BankAccountId, type InvestmentId } from '@/domain/core'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { NotFoundError, ok } from '@/api/http'
import {
  monthParams,
  profitAllocationPutSchema,
  type allocationDestinationSchema,
} from '@/api/contracts/profit-allocations'
import type { z } from '@/api/registry'
import { loadChartOfAccounts } from '../../reports/_assemble'

function toDomainDestination(
  destination: z.infer<typeof allocationDestinationSchema> | null,
): AllocationDestination | null {
  if (destination === null) return null
  switch (destination.kind) {
    case 'Investment':
      return { kind: 'Investment', investmentId: asId<InvestmentId>(destination.investmentId) }
    case 'BankAccount':
      return { kind: 'BankAccount', bankAccountId: asId<BankAccountId>(destination.bankAccountId) }
    case 'FreeText':
      return { kind: 'FreeText', name: destination.name }
  }
}

function serialize(allocation: ProfitAllocation) {
  return { ...allocation, unallocatedBalance: unallocatedBalance(allocation) }
}

export const GET = handler({
  operation: 'profit_allocations.read',
  params: monthParams,
  handle: async ({ session, params }) => {
    const { profitAllocationReader } = getRepositories()
    const allocation = await profitAllocationReader.findByMonth(session.userId, month(params.month))
    if (allocation === null) {
      throw new NotFoundError('A destinação do lucro deste mês ainda não existe.')
    }
    return ok(serialize(allocation))
  },
})

export const PUT = handler({
  operation: 'profit_allocations.save',
  params: monthParams,
  body: profitAllocationPutSchema,
  handle: async ({ session, params, body }) => {
    const targetMonth = month(params.month)
    const { entryReader, profitAllocationReader, profitAllocationWriter } = getRepositories()

    const [entries, chart] = await Promise.all([
      entryReader.listByMonth(session.userId, targetMonth),
      loadChartOfAccounts(session.userId),
    ])
    // "Destinar o Lucro" always acts on the CLOSED month's realised result
    // (PRD "Fluxo principal" passo 6: "consulta o DRE na base Pago, e define a
    // destinação do lucro") — never on a Previsto projection.
    const netProfit = computeIncomeStatement({
      entries,
      chart,
      view: 'Consolidated',
      month: targetMonth,
      statusFilter: 'Paid',
    }).netProfit

    if (!canAllocate(netProfit)) {
      throw new Error('profit_allocation.no_profit_to_allocate')
    }

    let allocation = emptyAllocation(targetMonth, netProfit)
    for (const bucket of ALLOCATION_BUCKETS) {
      for (const item of body.items[bucket as AllocationBucket]) {
        allocation = addItem(allocation, bucket as AllocationBucket, {
          destination: toDomainDestination(item.destination),
          amount: cents(item.amount),
        })
      }
    }

    const saved = await profitAllocationWriter.save(session.userId, allocation)
    // Read back through the same path GET uses, so the two never disagree
    // about what "saved" looks like.
    const stored = (await profitAllocationReader.findByMonth(session.userId, targetMonth)) ?? saved
    return ok(serialize(stored))
  },
})
