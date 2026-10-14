/**
 * `GET, PATCH, DELETE /api/v1/liabilities/{id}`.
 *
 * `PATCH` is "Editar dados cadastrais" (files_design/01 §12, Wireframe `91:2`
 * node `91:43`) — it does NOT regenerate the amortisation schedule, and it can
 * no longer be asked to. Only two things ever touch the schedule: creation
 * (`../route.ts`) and "Registrar reajuste de juros"
 * (`./rate-adjustments/route.ts`, the button `91:58` beside it in the group
 * `203:2`).
 *
 * This is not an open question, and the sources do not merely fail to forbid
 * the recomputation — they name its single trigger, in words: the legend under
 * the debt chart, `91:98` in the Wireframe and `949:72` in the Mockup
 * (`948:1687`), reads "Recalculado a cada reajuste de juros registrado", and
 * files_design/03 repeats it of "Valor previsto". So every field that FEEDS
 * `buildInstallmentSchedule` is omitted from `liabilityPatchSchema` and comes
 * back 422 instead of quietly desynchronising the screen; the reasoning and
 * the node ids live there (`@/api/contracts/liabilities`).
 *
 * What is left in the body — Nome, Credor / Instituição, Entidade,
 * Classificação, Valor da parcela — changes no number the Detalhe do Passivo
 * derives, so the merge below needs no shape check.
 */

import type { Liability } from '@/domain/assets'
import { asId, cents, type LiabilityId } from '@/domain/core'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { NotFoundError, noContent, ok } from '@/api/http'
import { liabilityPatchSchema } from '@/api/contracts/liabilities'
import { idParams } from '@/api/contracts/common'
import { serializeLiability } from '../_serialize'

export const GET = handler({
  operation: 'liabilities.read',
  params: idParams,
  handle: async ({ session, params }) => {
    const { liabilityReader } = getRepositories()
    const liability = await liabilityReader.findById(session.userId, asId<LiabilityId>(params.id))
    if (liability === null) {
      throw new NotFoundError('O passivo solicitado não existe.')
    }
    return ok(await serializeLiability(session.userId, liability))
  },
})

export const PATCH = handler({
  operation: 'liabilities.update',
  params: idParams,
  body: liabilityPatchSchema,
  handle: async ({ session, params, body }) => {
    const { liabilityReader, liabilityWriter } = getRepositories()
    const liabilityId = asId<LiabilityId>(params.id)
    const existing = await liabilityReader.findById(session.userId, liabilityId)
    if (existing === null) {
      throw new NotFoundError('O passivo solicitado não existe.')
    }

    const updated: Liability = {
      ...existing,
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.creditor !== undefined ? { creditor: body.creditor } : {}),
      ...(body.entity !== undefined ? { entity: body.entity } : {}),
      ...(body.classification !== undefined ? { classification: body.classification } : {}),
      ...(body.installmentAmount !== undefined
        ? { installmentAmount: cents(body.installmentAmount) }
        : {}),
    }

    const stored = await liabilityWriter.replace(session.userId, updated)
    return ok(await serializeLiability(session.userId, stored))
  },
})

export const DELETE = handler({
  operation: 'liabilities.remove',
  params: idParams,
  handle: async ({ session, params }) => {
    const { liabilityReader, liabilityWriter } = getRepositories()
    const liabilityId = asId<LiabilityId>(params.id)
    const existing = await liabilityReader.findById(session.userId, liabilityId)
    if (existing === null) {
      throw new NotFoundError('O passivo solicitado não existe.')
    }
    // Ao contrário das outras três telas de Patrimônio, este descarte não pode
    // ser recusado por cronograma: `liabilities.repository.ts` apaga
    // `rate_adjustments`, `installments` e `trace_events` na MESMA transação,
    // antes da dívida, então as três FKs RESTRICT de schema.ts nunca disparam.
    // É o que a frase de consequência da tela promete ("apaga a dívida, com o
    // cronograma de parcelas e o histórico dela") — files_design/02.
    //
    // A tradução de `isForeignKeyViolation` para `liabilities.in_use` fica no
    // repositório como rede: se alguém criar uma referência nova para
    // `liabilities` sem incluí-la na transação, o descarte volta 409 em vez de
    // vazar erro de driver.
    await liabilityWriter.remove(session.userId, liabilityId)
    return noContent()
  },
})
