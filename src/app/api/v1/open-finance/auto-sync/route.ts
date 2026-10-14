/**
 * `PUT /api/v1/open-finance/auto-sync` — "Sincronizar ao abrir o app"
 * (pedido do dono, 2026-10-01: "quero ter a opção de remover a
 * sincronização"). Desligada, a sincronização automática (PRD P53) para; o
 * que já foi importado, os vínculos e o "Sincronizar agora" ficam.
 */

import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { ok } from '@/api/http'
import { openFinanceAutoSyncBodySchema } from '@/api/contracts/open-finance'

export const PUT = handler({
  operation: 'open_finance.set_auto_sync',
  body: openFinanceAutoSyncBodySchema,
  handle: async ({ session, body }) => {
    await getRepositories().openFinanceSyncStateWriter.setAutoSync(session.userId, body.enabled)
    return ok({ enabled: body.enabled })
  },
})
