/**
 * `POST /api/v1/pending-allocations/{id}/allocations` — "Direcionar agora"
 * (files_design/01 §13).
 *
 * Same "Objeto Direcionamento" shape as `POST /tangible-assets/{id}/sale`
 * (`@/api/allocations`), and the same rule from `directPendingAllocation`
 * (src/domain/assets/pending-allocation-rules.ts): the allocations must sum to
 * EXACTLY the pending amount, all at once — this is not a partial top-up.
 */

import { directPendingAllocation } from '@/domain/assets'
import { add, asId, type PendingAllocationId } from '@/domain/core'
import { assertAllocationTargetsExist, toAllocations } from '@/api/allocations'
import { getRepositories, withTransaction } from '@/data'
import { handler } from '@/api/handler'
import { NotFoundError, ok } from '@/api/http'
import { directPendingSchema } from '@/api/contracts/pending-allocations'
import { idParams } from '@/api/contracts/common'

export const POST = handler({
  operation: 'pending_allocations.direct',
  params: idParams,
  body: directPendingSchema,
  handle: async ({ session, params, body }) => {
    const { pendingAllocationReader } = getRepositories()
    const pendingId = asId<PendingAllocationId>(params.id)

    const pending = await pendingAllocationReader.findById(session.userId, pendingId)
    if (pending === null) {
      throw new NotFoundError('O valor pendente de direcionamento solicitado não existe.')
    }

    const allocations = toAllocations(body.allocations)
    // Same rule as the sale: "Direcionar agora" resolves the Pendência for good,
    // so a target naming nothing would close it with the value going nowhere.
    await assertAllocationTargetsExist(session.userId, allocations)

    // A Pendência é a CAUDA da venda, e o Direcionamento aqui é o mesmo de lá:
    // credita o destino (ADR-0017 §4) e recusa Passivo. A contrapartida também
    // é a mesma — o bem já saiu do Ativo quando a venda aconteceu; este valor é
    // o pedaço dela que ficou sem destino.
    return withTransaction(async (repos) => {
      for (const allocation of allocations) {
        if (allocation.kind === 'Liability') {
          throw new Error('allocations.liability_not_supported')
        }
        if (allocation.kind === 'Investment') {
          const investimento = await repos.investmentReader.findById(
            session.userId,
            allocation.target,
          )
          if (investimento === null) {
            throw new NotFoundError('O investimento de destino não existe.')
          }
          await repos.investmentWriter.replace(session.userId, {
            ...investimento,
            accumulatedValue: add(investimento.accumulatedValue, allocation.amount),
          })
        }
      }

      const resolved = directPendingAllocation(pending, allocations)
      const stored = await repos.pendingAllocationWriter.replace(session.userId, resolved)
      return ok(stored)
    })
  },
})
