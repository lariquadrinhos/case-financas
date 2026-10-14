/**
 * `GET /api/v1/reports/income-statement` — DRE (files_design/01 §8.1).
 *
 * Integration test against the real SQLite adapter (`useTestRepositories`):
 * happy path (cascade + rows) and query validation. There is no id param on
 * this route, so there is no not-found path to cover here (per
 * `src/api/README.md`, that case applies only to single-resource routes).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { asId, cents, isoDate, type CategoryId } from '@/domain/core'
import { getRepositories } from '@/data'
import { seedEntriesFixture, type EntriesTestFixture } from '@/data/fixtures/entries-test-fixtures'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { GET } from './route'
import { GET as occurrencesGET } from '../../occurrences/route'

function get(query: string): Request {
  return new Request(`https://x/api/v1/reports/income-statement?${query}`)
}

describe('GET /api/v1/reports/income-statement', () => {
  let handle: TestRepositories
  let fixture: EntriesTestFixture

  beforeEach(async () => {
    handle = useTestRepositories()
    fixture = await seedEntriesFixture(TEST_USER_ID)
  })

  afterEach(() => {
    handle.teardown()
  })

  it('UC7 — computes the cascade and the "Lançamentos deste mês" rows for the month', async () => {
    const { entryWriter } = getRepositories()
    await entryWriter.create(TEST_USER_ID, {
      kind: 'Revenue',
      amount: cents(500_000),
      date: isoDate('2026-07-10'),
      status: 'Paid',
      recurrenceId: null,
      entity: 'PF',
      categoryId: asId<CategoryId>('salario-pro-labore'),
      classification: 'Current',
      bankAccountId: fixture.pfAccountId,
    })
    await entryWriter.create(TEST_USER_ID, {
      kind: 'Expense',
      amount: cents(150_000),
      date: isoDate('2026-07-15'),
      status: 'Paid',
      recurrenceId: null,
      entity: 'PF',
      categoryId: fixture.expenseCategoryId,
      classification: 'Current',
      bankAccountId: fixture.pfAccountId,
    })

    const response = await GET(get('month=2026-07&view=Consolidated&statusFilter=Paid'))

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      netProfit: number
      lines: unknown[]
      rows: unknown[]
    }
    // files_design/01 §15: the 13 lines always render, even on an empty month.
    expect(body.lines).toHaveLength(13)
    expect(body.netProfit).toBe(350_000)
    expect(body.rows).toHaveLength(2)
  })

  it('shows only the 13 empty lines when there is nothing in the month', async () => {
    const response = await GET(get('month=2026-01&view=Consolidated&statusFilter=Paid'))
    expect(response.status).toBe(200)
    const body = (await response.json()) as { netProfit: number; rows: unknown[] }
    expect(body.netProfit).toBe(0)
    expect(body.rows).toHaveLength(0)
  })

  it('rejects a request missing statusFilter with 422', async () => {
    const response = await GET(get('month=2026-07&view=Consolidated'))
    expect(response.status).toBe(422)
  })

  it('rejects an unknown view with 422', async () => {
    const response = await GET(get('month=2026-07&view=Sozinho&statusFilter=Paid'))
    expect(response.status).toBe(422)
  })

  it('rejects an unrecognised query field with 422 (.strict())', async () => {
    const response = await GET(
      get('month=2026-07&view=Consolidated&statusFilter=Paid&somethingElse=1'),
    )
    expect(response.status).toBe(422)
  })

  // UC29/UC34/UC42 — a future month, never visited via GET /occurrences,
  // still has to project the DRE from active recorrências. Read-only: no
  // occurrence gets written for this to work (docs/adr — reports stay pure
  // reads); asserted by never calling the occurrences route in this test.
  it('UC34 — projects a future, never-visited month from an open recorrência (Planned, read-only)', async () => {
    const { recurrenceWriter } = getRepositories()
    await recurrenceWriter.create(TEST_USER_ID, {
      template: {
        kind: 'Expense',
        amount: cents(200_000),
        entity: 'PF',
        categoryId: fixture.expenseCategoryId,
        classification: 'Current',
        bankAccountId: fixture.pfAccountId,
      },
      amountKind: 'Fixed',
      startDate: '2026-01-10',
      endsOn: null,
    } as never)

    const response = await GET(get('month=2026-12&view=Consolidated&statusFilter=Planned'))
    expect(response.status).toBe(200)
    const body = (await response.json()) as { netProfit: number; rows: unknown[] }
    expect(body.netProfit).toBe(-200_000)
    expect(body.rows).toHaveLength(1)

    // Genuinely read-only: nothing got materialized by asking for the report.
    const { occurrenceReader } = getRepositories()
    expect(await occurrenceReader.listByMonth(TEST_USER_ID, '2026-12' as never)).toEqual([])
  })

  it('bug de 2026-09-29 — a previsão de uma recorrência chega como OCORRÊNCIA, não como lançamento de id falso', async () => {
    // Medido: a linha projetada levava `entryId: "projected:<ocorrência>"`, e o
    // "Editar" do DRE abria /novo-lancamento com esse id — "Não foi possível
    // carregar este lançamento", porque não há lançamento nenhum.
    const { recurrenceWriter } = getRepositories()
    const recurrence = await recurrenceWriter.create(TEST_USER_ID, {
      template: {
        kind: 'Expense',
        amount: cents(200_000),
        entity: 'PF',
        categoryId: fixture.expenseCategoryId,
        classification: 'Current',
        bankAccountId: fixture.pfAccountId,
      },
      amountKind: 'Fixed',
      startDate: '2026-01-10',
      endsOn: null,
    } as never)

    const response = await GET(get('month=2026-12&view=Consolidated&statusFilter=Planned'))
    const body = (await response.json()) as { rows: { source: Record<string, string> }[] }
    expect(body.rows[0]?.source).toEqual({
      kind: 'Occurrence',
      occurrenceId: `${recurrence.id}:2026-12`,
      recurrenceId: recurrence.id,
    })
  })

  it('UC34 — a discarded occurrence for that month is NOT projected, even though the series is still open', async () => {
    const { recurrenceWriter, occurrenceReader, occurrenceWriter } = getRepositories()
    await recurrenceWriter.create(TEST_USER_ID, {
      template: {
        kind: 'Expense',
        amount: cents(200_000),
        entity: 'PF',
        categoryId: fixture.expenseCategoryId,
        classification: 'Current',
        bankAccountId: fixture.pfAccountId,
      },
      amountKind: 'Fixed',
      startDate: '2026-01-10',
      endsOn: null,
    } as never)

    // Materialize December exactly the way Revisão de Recorrentes does, then discard it.
    await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-12'))
    const [occurrence] = await occurrenceReader.listByMonth(TEST_USER_ID, '2026-12' as never)
    expect(occurrence).toBeDefined()
    await occurrenceWriter.replace(TEST_USER_ID, { ...occurrence!, discarded: true })

    const response = await GET(get('month=2026-12&view=Consolidated&statusFilter=Planned'))
    const body = (await response.json()) as { netProfit: number }
    expect(body.netProfit).toBe(0)
  })

  it('a "a definir" occurrence with no value yet contributes nothing to the projection', async () => {
    const { recurrenceWriter } = getRepositories()
    await recurrenceWriter.create(TEST_USER_ID, {
      template: {
        kind: 'Expense',
        amount: 0,
        entity: 'PF',
        categoryId: fixture.expenseCategoryId,
        classification: 'Current',
        bankAccountId: fixture.pfAccountId,
      },
      amountKind: 'ToBeDefined',
      startDate: '2026-01-10',
      endsOn: null,
    } as never)

    const response = await GET(get('month=2026-12&view=Consolidated&statusFilter=Planned'))
    const body = (await response.json()) as {
      netProfit: number
      rows: { amountToBeDefined?: boolean }[]
    }
    expect(body.netProfit).toBe(0)
    // Até 2026-10-01 a linha também ficava de fora; o dono pediu que o mês em
    // branco apareça em "Lançamentos deste mês", marcado "A definir".
    expect(body.rows).toHaveLength(1)
    expect(body.rows[0]?.amountToBeDefined).toBe(true)
  })

  it('ADR-0021 — `creditCard=true` recalcula a cascata só com a despesa do cartão', async () => {
    const { entryWriter } = getRepositories()
    const base = {
      kind: 'Expense' as const,
      date: isoDate('2026-07-15'),
      status: 'Paid' as const,
      recurrenceId: null,
      entity: 'PF' as const,
      categoryId: fixture.expenseCategoryId,
      classification: 'Current' as const,
      bankAccountId: fixture.pfAccountId,
    }
    await entryWriter.create(TEST_USER_ID, { ...base, amount: cents(30_000), isCreditCard: true })
    await entryWriter.create(TEST_USER_ID, { ...base, amount: cents(70_000) })
    const query = 'month=2026-07&view=Consolidated&statusFilter=Paid'
    const response = await GET(get(`${query}&creditCard=true`))
    expect(response.status).toBe(200)
    const body = (await response.json()) as { rows: { amount: number }[] }
    expect(body.rows.map((r) => r.amount)).toEqual([30_000])
  })

  // Simulação do DRE (2026-10-01): `hidden` tira da cascata, sem gravar nada.
  it('2026-10-01 — `hidden` simula o DRE sem um lançamento, sem gravar nada', async () => {
    const { entryWriter } = getRepositories()
    const despesa = await entryWriter.create(TEST_USER_ID, {
      kind: 'Expense',
      amount: cents(150_000),
      date: isoDate('2026-07-15'),
      status: 'Paid',
      recurrenceId: null,
      entity: 'PF',
      categoryId: fixture.expenseCategoryId,
      classification: 'Current',
      bankAccountId: fixture.pfAccountId,
    })
    const base = 'month=2026-07&view=Consolidated&statusFilter=Paid'
    const cheio = (await (await GET(get(base))).json()) as { netProfit: number }
    const response = await GET(get(`${base}&hidden=entry:${despesa.id}`))
    expect(response.status).toBe(200)
    const simulado = (await response.json()) as {
      netProfit: number
      rows: { hidden?: boolean }[]
    }
    expect(simulado.netProfit).toBe(cheio.netProfit + 150_000)
    expect(simulado.rows[0]?.hidden).toBe(true)
    // Nada gravado: sem `hidden`, volta tudo.
    expect(((await (await GET(get(base))).json()) as { netProfit: number }).netProfit).toBe(
      cheio.netProfit,
    )
  })

  it('2026-10-01 — `hidden=group:category:<id>` simula sem a categoria inteira', async () => {
    const { entryWriter } = getRepositories()
    for (const day of ['2026-07-10', '2026-07-20']) {
      await entryWriter.create(TEST_USER_ID, {
        kind: 'Expense',
        amount: cents(10_000),
        date: isoDate(day),
        status: 'Paid',
        recurrenceId: null,
        entity: 'PF',
        categoryId: fixture.expenseCategoryId,
        classification: 'Current',
        bankAccountId: fixture.pfAccountId,
      })
    }
    const base = 'month=2026-07&view=Consolidated&statusFilter=Paid'
    const cheio = (await (await GET(get(base))).json()) as { netProfit: number }
    const simulado = (await (
      await GET(get(`${base}&hidden=group:category:${fixture.expenseCategoryId}`))
    ).json()) as { netProfit: number }
    expect(simulado.netProfit).toBe(cheio.netProfit + 20_000)
  })

  it('2026-10-01 — `hidden` malformado responde 422', async () => {
    const response = await GET(
      get('month=2026-07&view=Consolidated&statusFilter=Paid&hidden=qualquer-coisa'),
    )
    expect(response.status).toBe(422)
  })

  // Relato de 2026-10-01: "minhas recorrências em a definir valor não estão
  // mostrando no lançamento do mês seguinte". Medido: 3 séries "a definir" com
  // novembro em branco; o DRE de novembro listava 8 recorrências, não 11.
  it('2026-10-01 — a recorrência "a definir" em branco aparece em "Lançamentos deste mês", marcada, sem mexer na cascata', async () => {
    const { recurrenceWriter } = getRepositories()
    await recurrenceWriter.create(TEST_USER_ID, {
      template: {
        kind: 'Expense',
        amount: cents(0),
        entity: 'PF',
        categoryId: fixture.expenseCategoryId,
        classification: 'Current',
        bankAccountId: fixture.pfAccountId,
      },
      amountKind: 'ToBeDefined',
      startDate: isoDate('2026-10-10'),
      endsOn: null,
    } as never)
    const response = await GET(get('month=2026-11&view=Consolidated&statusFilter=Planned'))
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      netProfit: number
      rows: { source: { kind: string }; amountToBeDefined?: boolean; amount: number }[]
    }
    const linha = body.rows.find((r) => r.source.kind === 'Occurrence')
    expect(linha).toMatchObject({ amountToBeDefined: true, amount: 0 })
    expect(body.netProfit).toBe(0)
  })
})
