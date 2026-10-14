/**
 * The composition root — the ONE place a port is bound to an adapter.
 *
 * A handler imports from here and never from `@/data/sqlite`. That is enforced
 * by ESLint (`no-restricted-imports` on `src/app/**` and `src/api/**`), because
 * the whole value of the port is lost the moment one handler reaches past it:
 * swapping SQLite for something else stops being "change this file" and becomes
 * "audit every handler".
 *
 * How a handler is meant to use it — the registry is an assembly, not a
 * dependency:
 *
 * ```ts
 * const { entryReader } = getRepositories()   // depend on the PORT you need
 * ```
 *
 * Never `function listEntries(repositories: Repositories)`. A function that
 * takes the whole registry depends on eleven ports to use one (SOLID/ISP), and
 * its test has to build eleven doubles.
 */

import type Database from 'better-sqlite3'
import { createSqliteRepositories } from './sqlite'
import { withNetWorthRecording } from './net-worth-recording'
import { todayIsoDate } from '@/lib/clock'
import { openDatabase, type BigornaDatabase } from './sqlite/client'
import { users } from './sqlite/schema'
import type { UserId } from './contracts/common'
import type { BankAccountReader, BankAccountWriter } from './contracts/bank-accounts'
import type {
  CategoryReader,
  CategoryWriter,
  StatementBlockReader,
  StatementBlockWriter,
} from './contracts/chart-of-accounts'
import type {
  DiscretionaryExpenseReader,
  DiscretionaryExpenseWriter,
  DiscretionarySpendingConfigReader,
  DiscretionarySpendingConfigWriter,
} from './contracts/discretionary-spending'
import type { EntryReader, EntryWriter } from './contracts/entries'
import type { InvestmentReader, InvestmentWriter } from './contracts/investments'
import type {
  InstallmentReader,
  InstallmentWriter,
  LiabilityReader,
  LiabilityWriter,
  RateAdjustmentReader,
  RateAdjustmentWriter,
} from './contracts/liabilities'
import type {
  PendingAllocationReader,
  PendingAllocationWriter,
} from './contracts/pending-allocations'
import type {
  LeftoverDirectionReader,
  LeftoverDirectionWriter,
  PaymentDiscrepancyReader,
  PaymentDiscrepancyWriter,
} from './contracts/pending-items'
import type { ProfitAllocationReader, ProfitAllocationWriter } from './contracts/profit-allocations'
import type { OnboardingProgressReader, OnboardingProgressWriter } from './contracts/onboarding'
import type {
  OccurrenceReader,
  OccurrenceWriter,
  RecurrenceReader,
  RecurrenceWriter,
} from './contracts/recurrences'
import type { TangibleAssetReader, TangibleAssetWriter } from './contracts/tangible-assets'
import type { TraceEventReader, TraceEventWriter } from './contracts/trace-events'
import type {
  NetWorthSnapshotReader,
  NetWorthSnapshotWriter,
} from './contracts/net-worth-snapshots'
import type {
  ImportedTransactionReader,
  ImportedTransactionWriter,
  OpenFinanceLinkReader,
  OpenFinanceLinkWriter,
  OpenFinanceReader,
  OpenFinanceSyncStateReader,
  OpenFinanceSyncStateWriter,
} from './contracts/open-finance'
import { createOpenFinanceReaderFromEnv } from './pluggy'

/**
 * Every port, each declared as its own interface. There is deliberately no
 * `EntryRepository` combining reader and writer: a screen that lists is not a
 * screen that deletes.
 */
export interface Repositories {
  readonly entryReader: EntryReader
  readonly entryWriter: EntryWriter
  readonly statementBlockReader: StatementBlockReader
  readonly statementBlockWriter: StatementBlockWriter
  readonly categoryReader: CategoryReader
  readonly categoryWriter: CategoryWriter
  readonly bankAccountReader: BankAccountReader
  readonly bankAccountWriter: BankAccountWriter
  readonly tangibleAssetReader: TangibleAssetReader
  readonly tangibleAssetWriter: TangibleAssetWriter
  readonly investmentReader: InvestmentReader
  readonly investmentWriter: InvestmentWriter
  readonly liabilityReader: LiabilityReader
  readonly liabilityWriter: LiabilityWriter
  readonly installmentReader: InstallmentReader
  readonly installmentWriter: InstallmentWriter
  readonly rateAdjustmentReader: RateAdjustmentReader
  readonly rateAdjustmentWriter: RateAdjustmentWriter
  readonly recurrenceReader: RecurrenceReader
  readonly recurrenceWriter: RecurrenceWriter
  readonly occurrenceReader: OccurrenceReader
  readonly occurrenceWriter: OccurrenceWriter
  readonly profitAllocationReader: ProfitAllocationReader
  readonly profitAllocationWriter: ProfitAllocationWriter
  readonly pendingAllocationReader: PendingAllocationReader
  readonly pendingAllocationWriter: PendingAllocationWriter
  readonly leftoverDirectionReader: LeftoverDirectionReader
  readonly leftoverDirectionWriter: LeftoverDirectionWriter
  readonly paymentDiscrepancyReader: PaymentDiscrepancyReader
  readonly paymentDiscrepancyWriter: PaymentDiscrepancyWriter
  readonly traceEventReader: TraceEventReader
  readonly traceEventWriter: TraceEventWriter
  readonly netWorthSnapshotReader: NetWorthSnapshotReader
  readonly netWorthSnapshotWriter: NetWorthSnapshotWriter
  readonly discretionarySpendingConfigReader: DiscretionarySpendingConfigReader
  readonly discretionarySpendingConfigWriter: DiscretionarySpendingConfigWriter
  readonly discretionaryExpenseReader: DiscretionaryExpenseReader
  readonly discretionaryExpenseWriter: DiscretionaryExpenseWriter
  readonly onboardingProgressReader: OnboardingProgressReader
  readonly onboardingProgressWriter: OnboardingProgressWriter
  readonly openFinanceLinkReader: OpenFinanceLinkReader
  readonly openFinanceLinkWriter: OpenFinanceLinkWriter
  readonly importedTransactionReader: ImportedTransactionReader
  readonly importedTransactionWriter: ImportedTransactionWriter
  readonly openFinanceSyncStateReader: OpenFinanceSyncStateReader
  readonly openFinanceSyncStateWriter: OpenFinanceSyncStateWriter
}

let repositories: Repositories | null = null
let rawConnection: Database.Database | null = null
let rawDb: BigornaDatabase | null = null

/**
 * Built once per process, lazily. Lazily because opening the file and running
 * the migrations at import time would make `next build` — which imports every
 * route module — create a database on a build machine.
 */
export function getRepositories(): Repositories {
  if (repositories === null) {
    const { db, connection } = openDatabase()
    // P21: os seis escritores de patrimônio saem daqui já tirando o retrato
    // mensal do PL. É aqui e não nas doze rotas que mexem em patrimônio porque
    // doze lugares são doze chances de esquecer um — e uma rota nova nasceria
    // sem ele. Ver src/data/net-worth-recording.ts.
    repositories = withNetWorthRecording(createSqliteRepositories(db), todayIsoDate)
    rawConnection = connection
    rawDb = db
  }
  return repositories
}

/**
 * Guarantees the ONE row every other table's foreign key hangs from
 * (`schema.ts`'s own header comment on `users`) exists before anything writes
 * user-scoped data.
 *
 * Measured, not assumed: a genuinely fresh `.data/bigorna.db` — migrations
 * run, no row ever inserted — throws `SQLITE_CONSTRAINT_FOREIGNKEY` on the
 * FIRST write onboarding's Plano de Contas step makes
 * (`ensureChartOfAccountsSeeded` → `statementBlockWriter.seed`), because
 * outside of `src/data/fixtures/seed.ts`'s own `ensureUserRow` (the synthetic
 * dev-scenario script) nothing had ever created that row. Onboarding is the
 * ONE screen whose entire job is to work on a database with nothing in it yet,
 * so this cannot be the seed script's responsibility alone — `getSession()`
 * calls this, once per phase-1 development session, idempotently.
 */
export async function ensureUserExists(userId: UserId): Promise<void> {
  getRepositories()
  if (rawDb === null) throw new Error('database.unavailable')
  rawDb
    .insert(users)
    .values({ id: userId, createdAt: new Date().toISOString() })
    .onConflictDoNothing()
    .run()
}

/**
 * Binds a different set of repositories. This is the seam a test uses to run
 * against `createInMemoryDatabase()`, and the seam phase 2 uses to bind a second
 * adapter — it exists so that swapping the implementation never means editing a
 * handler.
 *
 * `connection` and `db` are optional so call sites that never use
 * `withTransaction`/`ensureUserExists` do not have to thread them through —
 * but a test exercising a route that DOES need one of those must pass the
 * matching handle, or that route throws loudly (`transaction.unavailable`,
 * `database.unavailable`) at the seam that is wrong, instead of silently
 * reusing a stale connection from a previous `getRepositories()` call.
 */
export function setRepositories(
  next: Repositories | null,
  connection: Database.Database | null = null,
  db: BigornaDatabase | null = null,
): void {
  repositories = next
  rawConnection = connection
  rawDb = db
}

/**
 * The unit-of-work seam (ADR-0014). Every port is a separate, segregated
 * interface (SOLID/ISP) precisely so a handler never depends on more than it
 * uses — but "Marcar Pago" writes across three of them (o Lançamento, o
 * Evento, a Pendência), and files_design/03 is unconditional: um pagamento a
 * menos SEMPRE vira Pendência. Three independent auto-committed writes make
 * that "sempre" false the moment the second or third one fails after the
 * first succeeded — measured: forcing the discrepancy write to throw left the
 * lançamento marked Pago with no Pendência behind it (docs/adr/0014).
 *
 * All ports share ONE `BigornaDatabase`/connection (`src/data/sqlite/index.ts`
 * passes the same `db` to every adapter), so SQLite's own atomicity is
 * enough — this does not re-scope repositories to a transaction handle, it
 * brackets the SAME repositories `getRepositories()` already returns between
 * `BEGIN IMMEDIATE` and `COMMIT`/`ROLLBACK` on the shared connection. A
 * repository method that itself opens a `db.transaction(...)` (the schedule
 * rewrite in `liabilities.repository.ts`) composes safely nested inside this:
 * better-sqlite3 detects the already-open transaction and uses a SAVEPOINT
 * instead of a second `BEGIN` — verified directly against the native binding,
 * not assumed.
 */
export async function withTransaction<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
  const repos = getRepositories()
  const connection = rawConnection
  if (connection === null) {
    // Only reachable if a test bound repositories with `setRepositories(repos)`
    // and no connection, then exercised a route that needs a real transaction.
    throw new Error('transaction.unavailable')
  }

  connection.exec('BEGIN IMMEDIATE')
  try {
    const result = await work(repos)
    connection.exec('COMMIT')
    return result
  } catch (err) {
    // better-sqlite3 auto-rolls back on some native errors (e.g. a busy
    // timeout abort), so a second ROLLBACK on top of one already closed would
    // itself throw "no transaction is active" and mask the real error.
    if (connection.inTransaction) {
      connection.exec('ROLLBACK')
    }
    throw err
  }
}

let openFinanceReader: OpenFinanceReader | null = null

/**
 * The provider port (ADR-0020 §2). Not part of `Repositories` because it does
 * not read our database: it reads the bank, and its adapter is chosen by the
 * environment — the Pluggy adapter when `PLUGGY_CLIENT_ID` is set, otherwise
 * one that refuses with `open_finance.not_configured`, so an installation
 * without credentials works exactly as it did before.
 */
export function getOpenFinanceReader(): OpenFinanceReader {
  if (openFinanceReader === null) openFinanceReader = createOpenFinanceReaderFromEnv(process.env)
  return openFinanceReader
}

/** The seam a test uses to read a synthetic bank instead of the real one. */
export function setOpenFinanceReader(next: OpenFinanceReader | null): void {
  openFinanceReader = next
}

export type { Page, PagedResult, UserId } from './contracts/common'
export * from './contracts/bank-accounts'
export * from './contracts/chart-of-accounts'
export * from './contracts/discretionary-spending'
export * from './contracts/entries'
export * from './contracts/investments'
export * from './contracts/onboarding'
export * from './contracts/liabilities'
export * from './contracts/open-finance'
export * from './contracts/pending-allocations'
export * from './contracts/pending-items'
export * from './contracts/profit-allocations'
export * from './contracts/recurrences'
export * from './contracts/tangible-assets'
export * from './contracts/trace-events'
