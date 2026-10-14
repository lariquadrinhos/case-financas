/**
 * `GET, POST /api/v1/liabilities` — Passivos.
 *
 * `POST` does three things from the person's point of view (files_design/03
 * "Passivos (formulário completo)"): stores the Passivo, generates its full
 * amortisation schedule ("calculado por amortização", never digitado), and
 * appends the "Cadastro" trace event (UC21). The domain rule
 * (`buildInstallmentSchedule`) is the single source of the schedule's numbers;
 * this route only persists what it computed.
 */

import { cents, isoDate } from '@/domain/core'
import { buildInstallmentSchedule, liabilityRegisteredEvent } from '@/domain/assets'
import { todayIsoDate } from '@/lib/clock'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { created, list, resourcePath } from '@/api/http'
import { entitySchema } from '@/api/contracts/common'
import { newLiabilitySchema } from '@/api/contracts/liabilities'
import { serializeLiabilities, serializeLiability } from './_serialize'
import { z } from '@/api/registry'

const liabilityQuerySchema = z.strictObject({ entity: entitySchema.optional() })

export const GET = handler({
  operation: 'liabilities.list',
  query: liabilityQuerySchema,
  handle: async ({ session, query }) => {
    const { liabilityReader } = getRepositories()
    const items =
      query.entity === undefined
        ? await liabilityReader.list(session.userId)
        : await liabilityReader.listByEntity(session.userId, query.entity)
    return list(await serializeLiabilities(session.userId, items))
  },
})

export const POST = handler({
  operation: 'liabilities.create',
  body: newLiabilitySchema,
  handle: async ({ session, body }) => {
    const { liabilityWriter, installmentWriter, traceEventWriter } = getRepositories()

    const stored = await liabilityWriter.create(session.userId, {
      name: body.name,
      creditor: body.creditor,
      entity: body.entity,
      classification: body.classification,
      originalAmount: cents(body.originalAmount),
      installmentAmount: cents(body.installmentAmount),
      installmentCount: body.installmentCount,
      installmentsAlreadyPaid: body.installmentsAlreadyPaid,
      monthlyInterestRate: body.monthlyInterestRate,
      startDate: isoDate(body.startDate),
    })

    const schedule = buildInstallmentSchedule(stored)
    await installmentWriter.replaceSchedule(session.userId, stored.id, schedule)
    await traceEventWriter.append(session.userId, liabilityRegisteredEvent(stored, todayIsoDate()))

    return created(
      resourcePath('liabilities', stored.id),
      await serializeLiability(session.userId, stored),
    )
  },
})
