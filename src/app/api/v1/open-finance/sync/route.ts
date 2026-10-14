/**
 * `POST /api/v1/open-finance/sync` — lê o banco e importa o que chegou
 * (ADR-0020 §6).
 *
 * PRD P53, decided 2026-09-29: the app calls this when it opens, at most once
 * every six hours. The Meu Pluggy refreshes its connections once a day, so a
 * shorter interval only spends provider calls to read the same data. `force`
 * skips the interval, for the moment the person knows something just posted.
 */

import { getOpenFinanceReader, getRepositories, withTransaction } from '@/data'
import { handler } from '@/api/handler'
import { ok } from '@/api/http'
import { applyBankSnapshot, readBank } from '@/api/open-finance'
import { openFinanceSyncBodySchema } from '@/api/contracts/open-finance'
import { log } from '@/lib/log'
import { todayIsoDate } from '@/lib/clock'

const MIN_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000

/** O cabeçalho do card mostra "Sincronizado hoje, 18:05" e o "Sincronizar ao abrir o app". */
export const GET = handler({
  operation: 'open_finance.sync_status',
  handle: async ({ session }) => {
    const { openFinanceSyncStateReader } = getRepositories()
    return ok({
      lastSyncedAt: await openFinanceSyncStateReader.lastSyncedAt(session.userId),
      autoSync: await openFinanceSyncStateReader.autoSyncEnabled(session.userId),
    })
  },
})

export const POST = handler({
  operation: 'open_finance.sync',
  body: openFinanceSyncBodySchema,
  handle: async ({ session, body }) => {
    const repos = getRepositories()
    // Desligada pela pessoa (2026-10-01): só o "Sincronizar agora" lê o banco.
    if (!body.force && !(await repos.openFinanceSyncStateReader.autoSyncEnabled(session.userId))) {
      return ok({ status: 'Paused' })
    }
    const last = await repos.openFinanceSyncStateReader.lastSyncedAt(session.userId)
    if (!body.force && last !== null && Date.now() - Date.parse(last) < MIN_SYNC_INTERVAL_MS) {
      return ok({ status: 'Skipped', lastSyncedAt: last })
    }

    // The bank is read BEFORE the transaction opens: provider calls take
    // seconds, and `BEGIN IMMEDIATE` would hold the write lock for all of them.
    const snapshot = await readBank(repos, getOpenFinanceReader(), session.userId)
    const summary = await withTransaction((tx) =>
      applyBankSnapshot(tx, snapshot, session.userId, todayIsoDate()),
    )
    // Counts only: never an amount, a description or a provider id (ADR-0020 §7).
    log.info('open_finance.sync.ok', {
      balancesUpdated: summary.balancesUpdated,
      ...summary.imported,
    })
    return ok({ status: 'Synced', ...summary })
  },
})
