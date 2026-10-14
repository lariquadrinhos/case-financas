/**
 * `GET /api/v1/trace-events` — integration tests against the real SQLite
 * adapter (`useTestRepositories`).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { cents, isoDate } from '@/domain/core'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { GET } from './route'

describe('GET /api/v1/trace-events', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  async function seedLiability() {
    return handle.repositories.liabilityWriter.create(TEST_USER_ID, {
      name: 'Financiamento apartamento',
      creditor: 'Banco',
      entity: 'PF',
      classification: 'NonCurrent',
      originalAmount: cents(32_000_000),
      installmentAmount: cents(152_000),
      installmentCount: 360,
      installmentsAlreadyPaid: 0,
      monthlyInterestRate: 0.008,
      startDate: isoDate('2026-01-10'),
    })
  }

  it('starts empty for a fresh account', async () => {
    const response = await GET(new Request('https://x/api/v1/trace-events'))
    await expect(response.json()).resolves.toEqual({ data: [], meta: { total: 0 } })
  })

  it('listRecent is the default, newest first', async () => {
    const liability = await seedLiability()
    const { traceEventWriter } = handle.repositories
    await traceEventWriter.append(TEST_USER_ID, {
      date: isoDate('2026-01-10'),
      kind: 'Registration',
      origin: { kind: 'Liability', liabilityId: liability.id },
      description: 'Financiamento cadastrado',
    })
    await traceEventWriter.append(TEST_USER_ID, {
      date: isoDate('2026-02-10'),
      kind: 'InstallmentPaid',
      origin: { kind: 'Liability', liabilityId: liability.id },
      description: 'Parcela #1 paga: valor conforme previsto',
    })

    const response = await GET(new Request('https://x/api/v1/trace-events'))
    const body = (await response.json()) as { data: Array<{ kind: string }> }
    expect(body.data.map((e) => e.kind)).toEqual(['InstallmentPaid', 'Registration'])
  })

  it('filters by liabilityId — the Detalhe do Passivo log', async () => {
    const liability = await seedLiability()
    const { traceEventWriter } = handle.repositories
    const mine = await traceEventWriter.append(TEST_USER_ID, {
      date: isoDate('2026-01-10'),
      kind: 'Registration',
      origin: { kind: 'Liability', liabilityId: liability.id },
      description: 'Financiamento cadastrado',
    })

    const response = await GET(
      new Request(`https://x/api/v1/trace-events?liabilityId=${liability.id}`),
    )
    const body = (await response.json()) as { data: Array<{ id: string }> }
    // P35: a resposta carrega o nome ATUAL do Passivo de origem — é o que falta
    // à Home para montar a redação dela sobre o texto gravado, que é o do
    // Detalhe do Passivo e não repete o nome.
    expect(body.data).toEqual([{ ...mine, subject: liability.name }])
  })

  it('P35 — renomear o Passivo muda o que a Home mostra para eventos antigos', async () => {
    const liability = await seedLiability()
    const { traceEventWriter, liabilityWriter } = handle.repositories
    await traceEventWriter.append(TEST_USER_ID, {
      date: isoDate('2026-01-10'),
      kind: 'Registration',
      origin: { kind: 'Liability', liabilityId: liability.id },
      description: 'Dívida cadastrada: R$ 320.000,00, 360 parcelas, taxa inicial 0,80% a.m.',
    })
    await liabilityWriter.replace(TEST_USER_ID, { ...liability, name: 'Financiamento da casa' })

    const response = await GET(new Request('https://x/api/v1/trace-events'))
    const body = (await response.json()) as { data: Array<{ subject: string | null }> }
    // É a consequência aceita na decisão: o nome não é congelado junto com a
    // frase, é resolvido na leitura. A alternativa era gravar duas redações.
    expect(body.data[0]?.subject).toBe('Financiamento da casa')
  })

  it('rejects a limit above 200 with 422', async () => {
    const response = await GET(new Request('https://x/api/v1/trace-events?limit=500'))
    expect(response.status).toBe(422)
  })
})
