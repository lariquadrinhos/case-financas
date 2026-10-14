/**
 * Adaptador SQLite do retrato mensal do PL (P21).
 *
 * `onConflictDoUpdate` sobre a chave `(user_id, month, view)` é a gravação: um
 * mês pode ter o patrimônio mexido várias vezes, e o retrato do mês é o último
 * desses estados, não o primeiro.
 */

import { and, asc, eq } from 'drizzle-orm'
import type { Cents, IsoDate, Month, View } from '@/domain/core'
import type {
  NetWorthSnapshot,
  NetWorthSnapshotReader,
  NetWorthSnapshotWriter,
} from '@/data/contracts/net-worth-snapshots'
import type { UserId } from '@/data/contracts/common'
import type { BigornaDatabase } from './client'
import { netWorthSnapshots } from './schema'

type Row = typeof netWorthSnapshots.$inferSelect

function toDomain(row: Row): NetWorthSnapshot {
  return {
    month: row.month as Month,
    view: row.view as View,
    netWorth: row.netWorth as Cents,
    investmentsTotal: row.investmentsTotal as Cents,
    recordedOn: row.recordedOn as IsoDate,
  }
}

export function createNetWorthSnapshotRepository(
  db: BigornaDatabase,
): NetWorthSnapshotReader & NetWorthSnapshotWriter {
  return {
    async listByView(userId: UserId, view: View) {
      return db
        .select()
        .from(netWorthSnapshots)
        .where(and(eq(netWorthSnapshots.userId, userId), eq(netWorthSnapshots.view, view)))
        .orderBy(asc(netWorthSnapshots.month))
        .all()
        .map(toDomain)
    },

    async record(userId: UserId, snapshot: NetWorthSnapshot) {
      db.insert(netWorthSnapshots)
        .values({
          userId,
          month: snapshot.month,
          view: snapshot.view,
          netWorth: snapshot.netWorth,
          investmentsTotal: snapshot.investmentsTotal,
          recordedOn: snapshot.recordedOn,
        })
        .onConflictDoUpdate({
          target: [netWorthSnapshots.userId, netWorthSnapshots.month, netWorthSnapshots.view],
          set: {
            netWorth: snapshot.netWorth,
            investmentsTotal: snapshot.investmentsTotal,
            recordedOn: snapshot.recordedOn,
          },
        })
        .run()
    },
  }
}
