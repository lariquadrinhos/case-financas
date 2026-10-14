/**
 * `PATCH /api/v1/occurrences/{id}` — "Editar" on the Revisão de Recorrentes
 * (PRD UC14). Covers `ThisOnly` vs `WholeSeries`, the not-found path and the
 * conflict of editing an occurrence that is no longer "em aberto".
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { getRepositories } from '@/data'
import { seedEntriesFixture, type EntriesTestFixture } from '@/data/fixtures/entries-test-fixtures'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { GET, PATCH } from './route'
import { GET as occurrencesGET } from '../route'

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('PATCH /api/v1/occurrences/{id}', () => {
  let handle: TestRepositories
  let fixture: EntriesTestFixture

  beforeEach(async () => {
    handle = useTestRepositories()
    fixture = await seedEntriesFixture(TEST_USER_ID)
  })

  afterEach(() => {
    handle.teardown()
  })

  async function seedSeries(): Promise<{ recurrenceId: string }> {
    const { recurrenceWriter } = getRepositories()
    const recurrence = await recurrenceWriter.create(TEST_USER_ID, {
      template: {
        kind: 'Expense',
        amount: 150_000,
        entity: 'PF',
        categoryId: fixture.expenseCategoryId,
        classification: 'Current',
        bankAccountId: fixture.pfAccountId,
      },
      amountKind: 'Fixed',
      startDate: '2026-01-10',
      endsOn: null,
    } as never)
    return { recurrenceId: recurrence.id }
  }

  async function occurrenceIdOf(month: string): Promise<string> {
    const { occurrenceReader } = getRepositories()
    const [occurrence] = await occurrenceReader.listByMonth(TEST_USER_ID, month as never)
    return occurrence!.id
  }

  it('ThisOnly changes only the targeted occurrence', async () => {
    await seedSeries()
    await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-07'))
    await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-08'))
    const julyId = await occurrenceIdOf('2026-07')

    const response = await PATCH(
      jsonRequest(`https://x/api/v1/occurrences/${julyId}`, {
        plannedAmount: 200_000,
        scope: 'ThisOnly',
      }),
      params(julyId),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: Array<{ id: string; plannedAmount: number }> }
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({ id: julyId, plannedAmount: 200_000 })

    const augustId = await occurrenceIdOf('2026-08')
    const { occurrenceReader } = getRepositories()
    const august = await occurrenceReader.findById(TEST_USER_ID, augustId as never)
    expect(august?.plannedAmount).toBe(150_000)
  })

  it('PRD UC14 — WholeSeries rewrites the template and every occurrence still em aberto', async () => {
    await seedSeries()
    await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-07'))
    await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-08'))
    const julyId = await occurrenceIdOf('2026-07')

    const response = await PATCH(
      jsonRequest(`https://x/api/v1/occurrences/${julyId}`, {
        plannedAmount: 200_000,
        scope: 'WholeSeries',
      }),
      params(julyId),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      data: Array<{ month: string; plannedAmount: number }>
    }
    expect(body.data.map((o) => o.plannedAmount)).toEqual([200_000, 200_000])

    // The next month materialised AFTER the edit also carries the new value.
    await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-09'))
    const septemberId = await occurrenceIdOf('2026-09')
    const { occurrenceReader } = getRepositories()
    const september = await occurrenceReader.findById(TEST_USER_ID, septemberId as never)
    expect(september?.plannedAmount).toBe(200_000)
  })

  it('2026-10-01 — "Só esta": a descrição fica só neste mês', async () => {
    await seedSeries()
    await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-07'))
    await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-08'))
    const julyId = await occurrenceIdOf('2026-07')
    const response = await PATCH(
      jsonRequest(`https://x/api/v1/occurrences/${julyId}`, {
        plannedAmount: 150_000,
        description: 'Julho sintético',
        scope: 'ThisOnly',
      }),
      params(julyId),
    )
    expect(response.status).toBe(200)
    const { occurrenceReader } = getRepositories()
    expect((await occurrenceReader.findById(TEST_USER_ID, julyId as never))?.description).toBe(
      'Julho sintético',
    )
    const augustId = await occurrenceIdOf('2026-08')
    expect(
      (await occurrenceReader.findById(TEST_USER_ID, augustId as never))?.description ?? null,
    ).toBeNull()
  })

  it('2026-10-01 — "Toda a série": troca categoria e descrição da série', async () => {
    const { recurrenceId } = await seedSeries()
    await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-07'))
    const julyId = await occurrenceIdOf('2026-07')
    const { categoryReader, recurrenceReader } = getRepositories()
    const other = (await categoryReader.list(TEST_USER_ID)).find(
      (c) => c.id !== fixture.expenseCategoryId && c.blockId === 'despesas-pessoais',
    )!
    const response = await PATCH(
      jsonRequest(`https://x/api/v1/occurrences/${julyId}`, {
        plannedAmount: 150_000,
        description: 'Série sintética',
        scope: 'WholeSeries',
        template: {
          kind: 'Expense',
          amount: 150_000,
          entity: 'PF',
          categoryId: other.id,
          classification: 'Current',
          bankAccountId: fixture.pfAccountId,
        },
      }),
      params(julyId),
    )
    expect(response.status).toBe(200)
    const recurrence = await recurrenceReader.findById(TEST_USER_ID, recurrenceId as never)
    expect(recurrence?.template).toMatchObject({
      categoryId: other.id,
      description: 'Série sintética',
    })
  })

  it('2026-10-01 — "Só esta" com dados da série é recusado (422), com a frase que a tela mostra', async () => {
    await seedSeries()
    await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-07'))
    const julyId = await occurrenceIdOf('2026-07')
    const response = await PATCH(
      jsonRequest(`https://x/api/v1/occurrences/${julyId}`, {
        plannedAmount: 150_000,
        scope: 'ThisOnly',
        template: {
          kind: 'Expense',
          amount: 150_000,
          entity: 'PF',
          categoryId: fixture.expenseCategoryId,
          classification: 'Current',
          bankAccountId: fixture.pfAccountId,
        },
      }),
      params(julyId),
    )
    expect(response.status).toBe(422)
    const body = (await response.json()) as { detail: string }
    expect(body.detail).toContain('Toda a série')
  })

  it('2026-10-01 — categoria de receita numa série de despesa é recusada (422 entries.category_kind_mismatch)', async () => {
    await seedSeries()
    await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-07'))
    const julyId = await occurrenceIdOf('2026-07')
    const { categoryReader } = getRepositories()
    const revenue = (await categoryReader.list(TEST_USER_ID)).find(
      (c) => c.blockId === 'receita-bruta',
    )!
    const response = await PATCH(
      jsonRequest(`https://x/api/v1/occurrences/${julyId}`, {
        plannedAmount: 150_000,
        scope: 'WholeSeries',
        template: {
          kind: 'Expense',
          amount: 150_000,
          entity: 'PF',
          categoryId: revenue.id,
          classification: 'Current',
          bankAccountId: fixture.pfAccountId,
        },
      }),
      params(julyId),
    )
    expect(response.status).toBe(422)
  })

  it('2026-10-01 — GET lê uma ocorrência (o formulário de edição da série a usa)', async () => {
    await seedSeries()
    await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-07'))
    const julyId = await occurrenceIdOf('2026-07')
    const response = await GET(
      new Request(`https://x/api/v1/occurrences/${julyId}`),
      params(julyId),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ id: julyId, plannedAmount: 150_000 })
    const missing = await GET(new Request('https://x/api/v1/occurrences/nada'), params('nada'))
    expect(missing.status).toBe(404)
  })

  it('medido em 2026-10-06 — GET abre a ocorrência que o DRE projeta, mesmo sem visita à Revisão', async () => {
    const { recurrenceId } = await seedSeries()
    // O DRE de outubro lista `<série>:2026-10` sem gravá-la (ADR-0004: quem
    // grava é a visita à Revisão). O "Editar" da linha respondia 404.
    const projected = `${recurrenceId}:2026-10`
    const response = await GET(
      new Request(`https://x/api/v1/occurrences/${projected}`),
      params(projected),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ id: projected, plannedAmount: 150_000 })
  })

  it('medido em 2026-10-06 — um mês que a série NÃO gera continua 404', async () => {
    const { recurrenceId } = await seedSeries()
    const beforeStart = `${recurrenceId}:2025-12`
    const response = await GET(
      new Request(`https://x/api/v1/occurrences/${beforeStart}`),
      params(beforeStart),
    )
    expect(response.status).toBe(404)
  })

  it('404s for an id that does not exist', async () => {
    const response = await PATCH(
      jsonRequest('https://x/api/v1/occurrences/none', { plannedAmount: 1 }),
      params('none'),
    )
    expect(response.status).toBe(404)
  })

  it('src/domain/recurrence/engine.ts editOccurrence — 409 editing an occurrence already Paga', async () => {
    await seedSeries()
    await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-07'))
    const julyId = await occurrenceIdOf('2026-07')
    const { occurrenceReader, occurrenceWriter } = getRepositories()
    const july = await occurrenceReader.findById(TEST_USER_ID, julyId as never)
    await occurrenceWriter.replace(TEST_USER_ID, { ...july!, status: 'Paid' })

    const response = await PATCH(
      jsonRequest(`https://x/api/v1/occurrences/${julyId}`, { plannedAmount: 1 }),
      params(julyId),
    )
    expect(response.status).toBe(409)
  })

  it('audit — refuses a negative valor previsto (PRD §5: valor negativo é erro de dado)', async () => {
    await seedSeries()
    await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-07'))
    const julyId = await occurrenceIdOf('2026-07')
    const response = await PATCH(
      jsonRequest(`https://x/api/v1/occurrences/${julyId}`, { plannedAmount: -1 }),
      params(julyId),
    )
    expect(response.status).toBe(422)
  })

  it('422s a missing plannedAmount', async () => {
    await seedSeries()
    await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-07'))
    const julyId = await occurrenceIdOf('2026-07')
    const response = await PATCH(
      jsonRequest(`https://x/api/v1/occurrences/${julyId}`, { scope: 'ThisOnly' }),
      params(julyId),
    )
    expect(response.status).toBe(422)
  })
})
