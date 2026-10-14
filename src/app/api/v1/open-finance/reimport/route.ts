/**
 * `POST /api/v1/open-finance/reimport` — "Reimportar" (pedido do dono,
 * 2026-09-29). Desfaz o que a importação criou e importa de novo com as regras
 * e a configuração de agora (`undoImport`, src/api/open-finance.ts).
 *
 * Desfazer e reimportar acontecem na MESMA transação: se a reimportação
 * falhar, nada foi desfeito. O banco é lido antes, fora dela, como na
 * sincronização.
 */

import { getOpenFinanceReader, getRepositories, withTransaction } from '@/data'
import { handler } from '@/api/handler'
import { ok } from '@/api/http'
import { applyBankSnapshot, readBank, undoImport } from '@/api/open-finance'
import { log } from '@/lib/log'
import { todayIsoDate } from '@/lib/clock'

export const POST = handler({
  operation: 'open_finance.reimport',
  handle: async ({ session }) => {
    const snapshot = await readBank(getRepositories(), getOpenFinanceReader(), session.userId)
    const { undone, summary } = await withTransaction(async (tx) => {
      const undone = await undoImport(tx, session.userId)
      const summary = await applyBankSnapshot(tx, snapshot, session.userId, todayIsoDate())
      return { undone, summary }
    })
    log.info('open_finance.reimport.ok', {
      undone,
      balancesUpdated: summary.balancesUpdated,
      ...summary.imported,
    })
    return ok({ status: 'Synced', ...summary })
  },
})
