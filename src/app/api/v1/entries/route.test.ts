/**
 * `GET, POST /api/v1/entries` — integration tests against the real SQLite
 * adapter (`useTestRepositories`), per `src/api/README.md`: happy path,
 * validation, and the recorrência side-effect this route alone performs.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { getRepositories } from '@/data'
import { seedEntriesFixture, type EntriesTestFixture } from '@/data/fixtures/entries-test-fixtures'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { GET, POST } from './route'
import { GET as occurrencesGET } from '../occurrences/route'

function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
  })
}

describe('POST /api/v1/entries', () => {
  let handle: TestRepositories
  let fixture: EntriesTestFixture

  beforeEach(async () => {
    handle = useTestRepositories()
    fixture = await seedEntriesFixture(TEST_USER_ID)
  })

  afterEach(() => {
    handle.teardown()
  })

  it('creates a despesa and answers 201 with a Location header', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/entries', 'POST', {
        kind: 'Expense',
        amount: 150_000,
        date: '2026-07-10',
        categoryId: fixture.expenseCategoryId,
        bankAccountId: fixture.pfAccountId,
      }),
    )

    expect(response.status).toBe(201)
    expect(response.headers.get('location')).toMatch(/^\/api\/v1\/entries\/.+/)
    const body = (await response.json()) as { id: string; amount: number; status: string }
    expect(body).toMatchObject({ amount: 150_000, status: 'Paid', entity: 'PF' })
    expect(body.id).toBeTruthy()
  })

  it('PRD §5 cascata — medido em 2026-09-29: despesa numa categoria de Receita Bruta é recusada com a explicação', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/entries', 'POST', {
        kind: 'Expense',
        amount: 500000,
        date: '2026-09-05',
        status: 'Planned',
        entity: 'PJ',
        categoryId: 'salario-pro-labore',
        classification: 'Current',
        bankAccountId: fixture.pjAccountId,
        recurrence: null,
      }),
    )
    expect(response.status).toBe(422)
    const body = (await response.json()) as { code: string; detail: string }
    expect(body.code).toBe('entries.category_kind_mismatch')
    expect(body.detail).toMatch(/Pró-labore e Distribuição/)
  })

  it('Descrição (2026-09-29) — o lançamento guarda uma descrição livre e a devolve', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/entries', 'POST', {
        kind: 'Expense',
        amount: 12_000,
        date: '2026-07-10',
        categoryId: fixture.expenseCategoryId,
        bankAccountId: fixture.pfAccountId,
        description: 'Conserto sintético da geladeira',
      }),
    )
    expect(response.status).toBe(201)
    const body = (await response.json()) as { description?: string }
    expect(body.description).toBe('Conserto sintético da geladeira')
  })

  it('ADR-0021 — a despesa guarda "Cartão de crédito" e "Contabilizar em" e os devolve', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/entries', 'POST', {
        kind: 'Expense',
        amount: 12_000,
        date: '2026-10-15',
        categoryId: fixture.expenseCategoryId,
        bankAccountId: fixture.pfAccountId,
        isCreditCard: true,
        accountingMonth: '2026-09',
      }),
    )
    expect(response.status).toBe(201)
    const body = (await response.json()) as { isCreditCard?: boolean; accountingMonth?: string }
    expect([body.isCreditCard, body.accountingMonth]).toEqual([true, '2026-09'])

    const september = await GET(new Request('https://x/api/v1/entries?month=2026-09'))
    const listed = (await september.json()) as { data: { amount: number }[] }
    expect(listed.data.map((e) => e.amount)).toEqual([12_000])
  })

  it('ADR-0021 — sem os campos, a despesa não é do cartão e conta no mês do pagamento', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/entries', 'POST', {
        kind: 'Expense',
        amount: 12_000,
        date: '2026-10-15',
        categoryId: fixture.expenseCategoryId,
        bankAccountId: fixture.pfAccountId,
      }),
    )
    const body = (await response.json()) as { isCreditCard?: boolean; accountingMonth?: string }
    expect(body.isCreditCard ?? false).toBe(false)
    expect(body.accountingMonth ?? null).toBeNull()
  })

  it('dono 2026-10-09 — a receita guarda "Cartão de crédito" (o estorno no cartão)', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/entries', 'POST', {
        kind: 'Revenue',
        amount: 4,
        date: '2026-10-05',
        categoryId: 'outras-receitas-operacionais',
        bankAccountId: fixture.pfAccountId,
        isCreditCard: true,
      }),
    )
    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ isCreditCard: true })
  })

  it('ADR-0021 — "Contabilizar em" existe só na despesa', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/entries', 'POST', {
        kind: 'Revenue',
        amount: 12_000,
        date: '2026-10-15',
        categoryId: 'outras-receitas-operacionais',
        bankAccountId: fixture.pfAccountId,
        accountingMonth: '2026-09',
      }),
    )
    expect(response.status).toBe(422)
    // The schema's refusal, not the category's (`entries.category_kind_mismatch`).
    const body = (await response.json()) as { code: string }
    expect(body.code).not.toBe('entries.category_kind_mismatch')
  })

  it('rejects an unknown field with 422 instead of dropping it silently', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/entries', 'POST', {
        kind: 'Expense',
        amount: 1000,
        date: '2026-07-10',
        categoryId: fixture.expenseCategoryId,
        bankAccountId: fixture.pfAccountId,
        rogue: true,
      }),
    )
    expect(response.status).toBe(422)
  })

  it('rejects a malformed body with 400, not 422', async () => {
    const response = await POST(
      new Request('https://x/api/v1/entries', {
        method: 'POST',
        body: 'not json',
        headers: { 'content-type': 'application/json' },
      }),
    )
    expect(response.status).toBe(400)
  })

  it('files_design/03 — activating "Recorrência" starts a série and stamps the entry with it', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/entries', 'POST', {
        kind: 'Expense',
        amount: 150_000,
        date: '2026-07-10',
        categoryId: fixture.expenseCategoryId,
        bankAccountId: fixture.pfAccountId,
        recurrence: { amountKind: 'Fixed', endsOn: null },
      }),
    )

    expect(response.status).toBe(201)
    const body = (await response.json()) as { recurrenceId: string | null }
    expect(body.recurrenceId).toBeTruthy()

    const { recurrenceReader } = getRepositories()
    const created = await recurrenceReader.findById(TEST_USER_ID, body.recurrenceId as never)
    expect(created).not.toBeNull()
    expect(created?.template).toMatchObject({ kind: 'Expense', amount: 150_000 })
  })

  it('a pró-labore requires no entity and no categoria, and both accounts', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/entries', 'POST', {
        kind: 'ProLabore',
        amount: 800_000,
        date: '2026-07-05',
        sourceAccountId: fixture.pjAccountId,
        destinationAccountId: fixture.pfAccountId,
      }),
    )
    expect(response.status).toBe(201)
    const body = (await response.json()) as Record<string, unknown>
    expect('entity' in body).toBe(false)
    expect('categoryId' in body).toBe(false)
  })
})

/**
 * ADR-0019 (produto, 2026-09-23): a série começa no MÊS DO LANÇAMENTO. Antes, a
 * série começava no mês seguinte e o lançamento de origem nunca aparecia na
 * Revisão de Recorrentes: quem lançava "Contador, 15/10, Previsto, recorrente"
 * via a recorrência só a partir de novembro. Agora:
 *   - recorrente Previsto não grava lançamento avulso — a ocorrência do mês o
 *     representa (Revisão de Recorrentes, DRE Previsto);
 *   - recorrente Pago grava o lançamento e o vincula como a ocorrência paga do
 *     mês, então nada é contado em dobro.
 */
describe('POST /api/v1/entries — série começa no mês do lançamento (ADR-0019)', () => {
  let handle: TestRepositories
  let fixture: EntriesTestFixture

  beforeEach(async () => {
    handle = useTestRepositories()
    fixture = await seedEntriesFixture(TEST_USER_ID)
  })

  afterEach(() => {
    handle.teardown()
  })

  function recurringExpense(
    status: 'Planned' | 'Paid',
    amountKind: 'Fixed' | 'ToBeDefined' = 'Fixed',
  ) {
    return jsonRequest('https://x/api/v1/entries', 'POST', {
      kind: 'Expense',
      amount: 25_500,
      date: '2026-10-15',
      status,
      categoryId: fixture.expenseCategoryId,
      bankAccountId: fixture.pfAccountId,
      recurrence: { amountKind, endsOn: null },
    })
  }

  it('ADR-0019 — recorrente Previsto vira a ocorrência do próprio mês, sem lançamento avulso', async () => {
    const response = await POST(recurringExpense('Planned'))
    expect(response.status).toBe(201)

    const { entryReader, occurrenceReader, recurrenceReader } = getRepositories()
    expect(await entryReader.list(TEST_USER_ID)).toEqual([])

    const [recurrence] = await recurrenceReader.listOpen(TEST_USER_ID)
    expect(recurrence?.startDate).toBe('2026-10-15')
    const october = await occurrenceReader.listByMonth(TEST_USER_ID, '2026-10' as never)
    expect(october).toHaveLength(1)
    expect(october[0]).toMatchObject({
      plannedDate: '2026-10-15',
      plannedAmount: 25_500,
      status: 'Planned',
      entryId: null,
    })
  })

  it('ADR-0019 — "a definir" Previsto guarda o valor digitado na ocorrência do mês', async () => {
    await POST(recurringExpense('Planned', 'ToBeDefined'))

    const { occurrenceReader } = getRepositories()
    const [october] = await occurrenceReader.listByMonth(TEST_USER_ID, '2026-10' as never)
    expect(october?.plannedAmount).toBe(25_500)
  })

  it('ADR-0019 — recorrente Pago grava o lançamento e o vincula como a ocorrência paga do mês', async () => {
    const response = await POST(recurringExpense('Paid'))
    expect(response.status).toBe(201)
    const entry = (await response.json()) as { id: string; recurrenceId: string }

    const { occurrenceReader, recurrenceReader } = getRepositories()
    const recurrence = await recurrenceReader.findById(TEST_USER_ID, entry.recurrenceId as never)
    expect(recurrence?.startDate).toBe('2026-10-15')
    const october = await occurrenceReader.listByMonth(TEST_USER_ID, '2026-10' as never)
    expect(october).toHaveLength(1)
    expect(october[0]).toMatchObject({ status: 'Paid', entryId: entry.id })
  })

  it('PRD §5 — sem dupla contagem: a Revisão de outubro lista a série uma vez só', async () => {
    await POST(recurringExpense('Paid'))
    await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-10'))

    const { occurrenceReader } = getRepositories()
    expect(await occurrenceReader.listByMonth(TEST_USER_ID, '2026-10' as never)).toHaveLength(1)
  })

  it('ADR-0019 — o mês seguinte continua vindo da série, como Previsto', async () => {
    await POST(recurringExpense('Planned'))
    const response = await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-11'))
    const body = (await response.json()) as { data: { plannedDate: string; status: string }[] }

    expect(body.data).toEqual([
      expect.objectContaining({ plannedDate: '2026-11-15', status: 'Planned' }),
    ])
  })
})

describe('POST /api/v1/entries — Conta de origem (PJ) opcional (ADR-0018)', () => {
  let handle: TestRepositories
  let fixture: EntriesTestFixture

  beforeEach(async () => {
    handle = useTestRepositories()
    fixture = await seedEntriesFixture(TEST_USER_ID)
  })

  afterEach(() => {
    handle.teardown()
  })

  // Pedido de produto em 2026-09-23: o dinheiro nem sempre sai de uma conta PJ
  // cadastrada no app — pode cair direto na PF. Antes, o schema exigia
  // `sourceAccountId` e o CHECK `entries_intercompany_shape` recusava NULL.
  it('ADR-0018 — aceita pró-labore sem conta de origem e devolve a origem como null', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/entries', 'POST', {
        kind: 'ProLabore',
        amount: 800_000,
        date: '2026-07-05',
        destinationAccountId: fixture.pfAccountId,
      }),
    )

    expect(response.status).toBe(201)
    const body = (await response.json()) as Record<string, unknown>
    expect(body).toMatchObject({ sourceAccountId: null, destinationAccountId: fixture.pfAccountId })
  })

  it('ADR-0018 — vale também para distribuição de lucro recorrente (o modelo da série)', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/entries', 'POST', {
        kind: 'ProfitDistribution',
        amount: 500_000,
        date: '2026-07-05',
        destinationAccountId: fixture.pfAccountId,
        recurrence: { amountKind: 'Fixed', endsOn: null },
      }),
    )

    expect(response.status).toBe(201)
    const body = (await response.json()) as { recurrenceId: string }
    const { recurrenceReader } = getRepositories()
    const created = await recurrenceReader.findById(TEST_USER_ID, body.recurrenceId as never)
    expect(created?.template).toMatchObject({ kind: 'ProfitDistribution', sourceAccountId: null })
  })

  it('ADR-0018 — a conta de destino (PF) continua obrigatória', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/entries', 'POST', {
        kind: 'ProLabore',
        amount: 800_000,
        date: '2026-07-05',
        sourceAccountId: fixture.pjAccountId,
      }),
    )
    expect(response.status).toBe(422)
  })
})

describe('GET /api/v1/entries', () => {
  let handle: TestRepositories
  let fixture: EntriesTestFixture

  beforeEach(async () => {
    handle = useTestRepositories()
    fixture = await seedEntriesFixture(TEST_USER_ID)
  })

  afterEach(() => {
    handle.teardown()
  })

  it('starts empty for a fresh account', async () => {
    const response = await GET(new Request('https://x/api/v1/entries'))
    await expect(response.json()).resolves.toEqual({ data: [], meta: { total: 0 } })
  })

  it('lists what was created and filters by month and status', async () => {
    await POST(
      jsonRequest('https://x/api/v1/entries', 'POST', {
        kind: 'Expense',
        amount: 1000,
        date: '2026-07-10',
        categoryId: fixture.expenseCategoryId,
        bankAccountId: fixture.pfAccountId,
      }),
    )
    await POST(
      jsonRequest('https://x/api/v1/entries', 'POST', {
        kind: 'Expense',
        amount: 2000,
        date: '2026-08-01',
        status: 'Planned',
        categoryId: fixture.expenseCategoryId,
        bankAccountId: fixture.pfAccountId,
      }),
    )

    const all = await GET(new Request('https://x/api/v1/entries'))
    await expect(all.json()).resolves.toMatchObject({ meta: { total: 2 } })

    const julyOnly = await GET(new Request('https://x/api/v1/entries?month=2026-07'))
    const body = (await julyOnly.json()) as { data: Array<{ amount: number }> }
    expect(body.data).toHaveLength(1)
    expect(body.data[0]?.amount).toBe(1000)
  })

  it('a bad month in the query is 422, not a crash', async () => {
    const response = await GET(new Request('https://x/api/v1/entries?month=2026-13'))
    expect(response.status).toBe(422)
  })
})

/**
 * Regressions found in the "Lançamentos e Recorrência" audit.
 */
describe('POST /api/v1/entries — audit regressions', () => {
  let handle: TestRepositories
  let fixture: EntriesTestFixture

  beforeEach(async () => {
    handle = useTestRepositories()
    fixture = await seedEntriesFixture(TEST_USER_ID)
  })

  afterEach(() => {
    handle.teardown()
  })

  // ADR-0019 revoga "a série começa no mês SEGUINTE" (leitura da v6 para
  // UC13): ela começa no mês do lançamento, e o que impede a duplicata agora é
  // a ocorrência desse mês APONTAR para o lançamento (`entryId`), que o DRE
  // Previsto e a Revisão já sabem não repetir.
  it('ADR-0019 — a série começa no mês do lançamento, sem duplicar aquele mês', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/entries', 'POST', {
        kind: 'Expense',
        amount: 150_000,
        date: '2026-07-10',
        categoryId: fixture.expenseCategoryId,
        bankAccountId: fixture.pfAccountId,
        recurrence: { amountKind: 'Fixed', endsOn: null },
      }),
    )
    const body = (await response.json()) as { id: string; recurrenceId: string }

    const { recurrenceReader, occurrenceReader } = getRepositories()
    const series = await recurrenceReader.findById(TEST_USER_ID, body.recurrenceId as never)
    expect(series?.startDate).toBe('2026-07-10')
    const july = await occurrenceReader.listByMonth(TEST_USER_ID, '2026-07' as never)
    expect(july).toEqual([expect.objectContaining({ entryId: body.id, status: 'Paid' })])
  })

  it('a série nascida no dia 31 cai no último dia de um mês mais curto', async () => {
    await POST(
      jsonRequest('https://x/api/v1/entries', 'POST', {
        kind: 'Expense',
        amount: 150_000,
        date: '2026-01-31',
        categoryId: fixture.expenseCategoryId,
        bankAccountId: fixture.pfAccountId,
        recurrence: { amountKind: 'Fixed', endsOn: null },
      }),
    )
    const response = await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-02'))
    const february = (await response.json()) as { data: { plannedDate: string }[] }
    expect(february.data).toEqual([expect.objectContaining({ plannedDate: '2026-02-28' })])
  })

  it('a categoria that does not exist is 404, not 500', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/entries', 'POST', {
        kind: 'Expense',
        amount: 150_000,
        date: '2026-07-10',
        categoryId: 'categoria-que-nao-existe',
        bankAccountId: fixture.pfAccountId,
      }),
    )
    expect(response.status).toBe(404)
    const body = (await response.json()) as { code: string; detail: string }
    expect(body.code).toBe('entries.unknown_reference')
    // ADR-0009 §3: no stack, no SQL, no file path in the body the person copies.
    expect(body.detail).not.toMatch(/SQLITE|select |insert |\//i)
  })

  it('a conta bancária that does not exist is 404, not 500', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/entries', 'POST', {
        kind: 'Expense',
        amount: 150_000,
        date: '2026-07-10',
        categoryId: fixture.expenseCategoryId,
        bankAccountId: 'conta-que-nao-existe',
      }),
    )
    expect(response.status).toBe(404)
  })

  it('PRD §5 — a negative amount is refused, not stored as a despesa that adds', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/entries', 'POST', {
        kind: 'Expense',
        amount: -150_000,
        date: '2026-07-10',
        categoryId: fixture.expenseCategoryId,
        bankAccountId: fixture.pfAccountId,
      }),
    )
    expect(response.status).toBe(422)
  })
})
