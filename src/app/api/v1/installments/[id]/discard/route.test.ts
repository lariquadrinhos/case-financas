/**
 * `POST /api/v1/installments/{id}/discard` — "Descartar" numa Parcela de
 * Passivo, o terceiro botão da linha de Passivo na Revisão de Recorrentes
 * (Figma `10:2` nó 144:17). O efeito é o que o frame `34:2` nó 34:36 escreve:
 * pula a parcela deste mês, sem deslocar o cronograma nem mexer no saldo.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { buildInstallmentSchedule, outstandingBalance } from '@/domain/assets'
import { cents, isoDate } from '@/domain/core'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { POST } from './route'

function context(id: string) {
  return { params: Promise.resolve({ id }) }
}

function discardRequest(id: string): Request {
  return new Request(`https://x/api/v1/installments/${id}/discard`, { method: 'POST' })
}

describe('POST /api/v1/installments/{id}/discard', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  async function seedSchedule() {
    const liability = await handle.repositories.liabilityWriter.create(TEST_USER_ID, {
      name: 'Financiamento apartamento',
      creditor: 'Caixa Econômica',
      entity: 'PF',
      classification: 'NonCurrent',
      originalAmount: cents(32000000),
      installmentAmount: cents(152000),
      installmentCount: 3,
      installmentsAlreadyPaid: 0,
      monthlyInterestRate: 0.008,
      startDate: isoDate('2026-01-10'),
    })
    const schedule = await handle.repositories.installmentWriter.replaceSchedule(
      TEST_USER_ID,
      liability.id,
      buildInstallmentSchedule(liability),
    )
    return { liability, schedule }
  }

  it('Figma 34:2 nó 34:36 — descarta a parcela e deixa o cronograma e o saldo devedor intactos', async () => {
    const { liability, schedule } = await seedSchedule()
    const before = outstandingBalance(schedule, liability.monthlyInterestRate)

    const response = await POST(discardRequest(schedule[0]!.id), context(schedule[0]!.id))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      id: schedule[0]!.id,
      discarded: true,
      status: 'Planned',
    })

    const stored = await handle.repositories.installmentReader.listByLiability(
      TEST_USER_ID,
      liability.id,
    )
    expect(stored.map((installment) => [installment.number, installment.plannedDate])).toEqual(
      schedule.map((installment) => [installment.number, installment.plannedDate]),
    )
    expect(outstandingBalance(stored, liability.monthlyInterestRate)).toBe(before)
  })

  it('404s for an id that does not exist', async () => {
    const response = await POST(discardRequest('none'), context('none'))
    expect(response.status).toBe(404)
  })

  it('409s a parcela já Paga — "Descartar" é ação da lista do Previsto (files_design/01 §6)', async () => {
    const { schedule } = await seedSchedule()
    await handle.repositories.installmentWriter.replace(TEST_USER_ID, {
      ...schedule[0]!,
      status: 'Paid',
      paidAmount: schedule[0]!.plannedAmount,
    })

    const response = await POST(discardRequest(schedule[0]!.id), context(schedule[0]!.id))
    expect(response.status).toBe(409)
  })
})
