/**
 * Where the SQLite adapters are assembled into the port registry.
 *
 * This file is the ONLY thing `src/data/index.ts` knows about this folder, and
 * it is intentionally the only file in it that lists every aggregate: adding an
 * adapter is one import and one line here, and it touches nothing outside
 * `src/data/`.
 *
 * Aggregates without an adapter yet fall back to `unimplementedPort`
 * (`./not-implemented.ts`): the registry it returns is always shaped like the
 * whole `Repositories` contract, but a port with no real adapter throws — at
 * CALL time, loudly, with a code — the moment a route actually invokes it,
 * rather than at import time. The alternative would be a set of objects whose
 * methods silently answer `null`, and a repository that answers "no rows" when
 * it means "not implemented" is how a screen ends up showing an empty DRE and
 * nobody noticing for a week.
 */

import type { Repositories } from '@/data'
import { createBankAccountRepository } from './bank-accounts.repository'
import {
  createCategoryRepository,
  createStatementBlockRepository,
} from './chart-of-accounts.repository'
import type { BigornaDatabase } from './client'
import {
  createDiscretionaryExpenseRepository,
  createDiscretionarySpendingConfigRepository,
} from './discretionary-spending.repository'
import { createLeftoverDirectionRepository } from './leftover-directions.repository'
import { createEntryRepository } from './entries.repository'
import { createInvestmentRepository } from './investments.repository'
import {
  createInstallmentRepository,
  createLiabilityRepository,
  createRateAdjustmentRepository,
} from './liabilities.repository'
import { createOnboardingProgressRepository } from './onboarding.repository'
import { createPendingAllocationRepository } from './pending-allocations.repository'
import { createPaymentDiscrepancyRepository } from './pending-items.repository'
import { createProfitAllocationRepository } from './profit-allocations.repository'
import { createOccurrenceRepository, createRecurrenceRepository } from './recurrences.repository'
import { createTangibleAssetRepository } from './tangible-assets.repository'
import { createTraceEventRepository } from './trace-events.repository'
import { createNetWorthSnapshotRepository } from './net-worth-snapshots.repository'
import { createOpenFinanceRepositories } from './open-finance.repository'

export function createSqliteRepositories(db: BigornaDatabase): Repositories {
  const statementBlocks = createStatementBlockRepository(db)
  const categoryRepo = createCategoryRepository(db)
  const bankAccounts = createBankAccountRepository(db)
  const tangibleAssets = createTangibleAssetRepository(db)
  const investmentsRepo = createInvestmentRepository(db)
  const liabilityRepo = createLiabilityRepository(db)
  const installmentRepo = createInstallmentRepository(db)
  const rateAdjustmentRepo = createRateAdjustmentRepository(db)
  const pendingAllocations = createPendingAllocationRepository(db)
  const paymentDiscrepancies = createPaymentDiscrepancyRepository(db)
  const traceEvents = createTraceEventRepository(db)
  const netWorthSnapshotRepo = createNetWorthSnapshotRepository(db)
  const profitAllocationRepo = createProfitAllocationRepository(db)
  const discretionaryConfig = createDiscretionarySpendingConfigRepository(db)
  const discretionaryExpense = createDiscretionaryExpenseRepository(db)
  const leftoverDirection = createLeftoverDirectionRepository(db)
  const entryRepo = createEntryRepository(db)
  const recurrenceRepo = createRecurrenceRepository(db)
  const occurrenceRepo = createOccurrenceRepository(db)
  const onboardingRepo = createOnboardingProgressRepository(db)
  const openFinance = createOpenFinanceRepositories(db)

  return {
    statementBlockReader: statementBlocks.reader,
    statementBlockWriter: statementBlocks.writer,
    categoryReader: categoryRepo.reader,
    categoryWriter: categoryRepo.writer,
    bankAccountReader: bankAccounts.reader,
    bankAccountWriter: bankAccounts.writer,
    tangibleAssetReader: tangibleAssets.reader,
    tangibleAssetWriter: tangibleAssets.writer,
    investmentReader: investmentsRepo.reader,
    investmentWriter: investmentsRepo.writer,
    liabilityReader: liabilityRepo.reader,
    liabilityWriter: liabilityRepo.writer,
    installmentReader: installmentRepo.reader,
    installmentWriter: installmentRepo.writer,
    rateAdjustmentReader: rateAdjustmentRepo.reader,
    rateAdjustmentWriter: rateAdjustmentRepo.writer,
    pendingAllocationReader: pendingAllocations.reader,
    pendingAllocationWriter: pendingAllocations.writer,
    paymentDiscrepancyReader: paymentDiscrepancies.reader,
    paymentDiscrepancyWriter: paymentDiscrepancies.writer,
    traceEventReader: traceEvents.reader,
    traceEventWriter: traceEvents.writer,
    netWorthSnapshotReader: netWorthSnapshotRepo,
    netWorthSnapshotWriter: netWorthSnapshotRepo,
    profitAllocationReader: profitAllocationRepo.reader,
    profitAllocationWriter: profitAllocationRepo.writer,
    leftoverDirectionReader: leftoverDirection.reader,
    leftoverDirectionWriter: leftoverDirection.writer,
    discretionarySpendingConfigReader: discretionaryConfig.reader,
    discretionarySpendingConfigWriter: discretionaryConfig.writer,
    discretionaryExpenseReader: discretionaryExpense.reader,
    discretionaryExpenseWriter: discretionaryExpense.writer,
    entryReader: entryRepo.reader,
    entryWriter: entryRepo.writer,
    recurrenceReader: recurrenceRepo.reader,
    recurrenceWriter: recurrenceRepo.writer,
    occurrenceReader: occurrenceRepo.reader,
    occurrenceWriter: occurrenceRepo.writer,
    onboardingProgressReader: onboardingRepo.reader,
    onboardingProgressWriter: onboardingRepo.writer,
    openFinanceLinkReader: openFinance.links.reader,
    openFinanceLinkWriter: openFinance.links.writer,
    importedTransactionReader: openFinance.imported.reader,
    importedTransactionWriter: openFinance.imported.writer,
    openFinanceSyncStateReader: openFinance.syncState.reader,
    openFinanceSyncStateWriter: openFinance.syncState.writer,
  }
}
