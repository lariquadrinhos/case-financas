/**
 * "Vincular ao banco" (dono, 2026-10-09): "quero associar um depósito manual ao
 * open finance para não ter duplicidade e ter rastreabilidade". O casamento
 * automático (P49) só cobre mesmo valor e até 5 dias; fora disso a transação
 * vira um segundo lançamento. Aqui a pessoa escolhe a transação à mão, e o
 * banco vale para valor e data. Dados sintéticos.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { asId, cents, isoDate, type EntryId } from '@/domain/core'
import { UNCATEGORIZED_CATEGORIES } from '@/domain/chart-of-accounts'
import type { ProviderAccountId, ProviderTransactionId } from '@/domain/open-finance'
import { getRepositories } from '@/data'
import { seedEntriesFixture, type EntriesTestFixture } from '@/data/fixtures/entries-test-fixtures'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { GET, POST } from './route'
import { GET as readEntry } from '../route'
import { GET as listEntries } from '../../route'

const PROV = 'prov-corrente' as ProviderAccountId
const params = (id: string) => ({ params: Promise.resolve({ id }) })

describe('/api/v1/entries/{id}/bank-link', () => {
  let handle: TestRepositories
  let fixture: EntriesTestFixture
  let manualId: EntryId
  let duplicateId: EntryId

  beforeEach(async () => {
    handle = useTestRepositories()
    fixture = await seedEntriesFixture(TEST_USER_ID)
    const repos = getRepositories()
    // "A categorizar" é semeada pela sincronização, não pelo Plano de Contas.
    await repos.categoryWriter.seed(TEST_USER_ID, UNCATEGORIZED_CATEGORIES)
    await repos.openFinanceLinkWriter.save(TEST_USER_ID, {
      providerAccountId: PROV,
      target: { kind: 'BankAccount', bankAccountId: fixture.pfAccountId },
      linkedOn: isoDate('2026-09-29'),
    })
    const receita = {
      kind: 'Revenue' as const,
      recurrenceId: null,
      entity: 'PF' as const,
      categoryId: asId('outras-receitas-operacionais'),
      classification: 'Current' as const,
      bankAccountId: fixture.pfAccountId,
    }
    const manual = await repos.entryWriter.create(TEST_USER_ID, {
      ...receita,
      amount: cents(100_000),
      date: isoDate('2026-10-01'),
      status: 'Planned',
      description: 'Depósito sintético',
    } as never)
    manualId = manual.id
    // O que a sincronização criou com o valor e a data reais do banco.
    const duplicate = await repos.entryWriter.create(TEST_USER_ID, {
      ...receita,
      categoryId: asId('a-categorizar-receita'),
      amount: cents(100_050),
      date: isoDate('2026-10-08'),
      status: 'Paid',
    } as never)
    duplicateId = duplicate.id
    await repos.importedTransactionWriter.record(TEST_USER_ID, {
      transactionId: 'tx-dep' as ProviderTransactionId,
      accountId: PROV,
      date: isoDate('2026-10-08'),
      amount: cents(100_050),
      description: 'TED recebida sintética',
      outcome: 'Entry',
      entryId: duplicateId,
      settledOn: null,
    })
  })

  afterEach(() => handle.teardown())

  it('dono 2026-10-09 — lista a transação da mesma conta, mesmo sentido, até 15 dias', async () => {
    const response = await GET(
      new Request(`https://x/api/v1/entries/${manualId}/bank-link`),
      params(manualId),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: { transactionId: string; amount: number }[] }
    expect(body.data.map((c) => [c.transactionId, c.amount])).toEqual([['tx-dep', 100_050]])
  })

  it('dono 2026-10-09 — vincular: valor e data do banco, um lançamento só, origem registrada', async () => {
    const response = await POST(
      new Request(`https://x/api/v1/entries/${manualId}/bank-link`, {
        method: 'POST',
        body: JSON.stringify({ transactionId: 'tx-dep' }),
        headers: { 'content-type': 'application/json' },
      }),
      params(manualId),
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      id: manualId,
      amount: 100_050,
      date: '2026-10-08',
      status: 'Paid',
      description: 'Depósito sintético',
      categoryId: 'outras-receitas-operacionais',
      linkedToBank: true,
    })
    const repos = getRepositories()
    expect(await repos.entryReader.findById(TEST_USER_ID, duplicateId)).toBeNull()
    const [registro] = await repos.importedTransactionReader.listRecords(TEST_USER_ID)
    expect(registro?.entryId).toBe(manualId)

    const lido = await readEntry(
      new Request(`https://x/api/v1/entries/${manualId}`),
      params(manualId),
    )
    await expect(lido.json()).resolves.toMatchObject({ linkedToBank: true })
    const lista = await listEntries(new Request('https://x/api/v1/entries'))
    const { data } = (await lista.json()) as { data: { id: string; linkedToBank?: boolean }[] }
    expect(data.find((e) => e.id === manualId)?.linkedToBank).toBe(true)
  })

  it('dono 2026-10-09 — uma transação que não é candidata é recusada (422), e nada muda', async () => {
    const response = await POST(
      new Request(`https://x/api/v1/entries/${manualId}/bank-link`, {
        method: 'POST',
        body: JSON.stringify({ transactionId: 'tx-inexistente' }),
        headers: { 'content-type': 'application/json' },
      }),
      params(manualId),
    )
    expect(response.status).toBe(422)
    expect(await getRepositories().entryReader.findById(TEST_USER_ID, duplicateId)).not.toBeNull()
  })

  it('dono 2026-10-09 — o próprio lançamento do banco não oferece vínculo (já é a transação)', async () => {
    const response = await GET(
      new Request(`https://x/api/v1/entries/${duplicateId}/bank-link`),
      params(duplicateId),
    )
    const body = (await response.json()) as { data: unknown[] }
    expect(body.data).toEqual([])
  })
})
