/**
 * `GET /api/v1/pending-allocations` — Pendente de Direcionamento
 * (files_design/01 §13, files_design/03).
 *
 * Read-only over collection: a pending amount is never created by a client,
 * it appears when a venda de bem material leaves money undirected. Filtering
 * by status is optional — the Home reads only `Pending`, a future screen may
 * want the full history.
 */

import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { list } from '@/api/http'
import { PENDING_ALLOCATION_STATUSES } from '@/domain/assets'
import { z } from '@/api/registry'

// Same (unregistered) shape `src/api/contracts/pending-allocations.ts` documents
// for this endpoint — kept anonymous here too, so there is one definition of it.
const query = z.strictObject({ status: z.enum(PENDING_ALLOCATION_STATUSES).optional() })

export const GET = handler({
  operation: 'pending_allocations.list',
  query,
  handle: async ({ session, query: filter }) => {
    const { pendingAllocationReader } = getRepositories()
    const items =
      filter.status === undefined
        ? await pendingAllocationReader.list(session.userId)
        : await pendingAllocationReader.listByStatus(session.userId, filter.status)
    return list(items)
  },
})
