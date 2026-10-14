/**
 * `GET, PATCH, DELETE /api/v1/entries/{id}` — integration tests against the
 * real SQLite adapter: happy path, validation and the not-found path.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { cents, isoDate } from '@/domain/core'
import { getRepositories } from '@/data'
import { seedEntriesFixture, type EntriesTestFixture } from '@/data/fixtures/entries-test-fixtures'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { DELETE, GET, PATCH } from './route'
import { POST as payEntry } from './payment/route'
import { POST as createEntryRoute } from '../route'
import { GET as occurrencesGET } from '../../occurrences/route'
import { POST as payOccurrence } from '../../occurrences/[id]/payment/route'

function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
  })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('/api/v1/entries/{id}', () => {
  let handle: TestRepositories
  let fixture: EntriesTestFixture

  beforeEach(async () => {
    handle = useTestRepositories()
    fixture = await seedEntriesFixture(TEST_USER_ID)
  })

  afterEach(() => {
    handle.teardown()
  })

  async function createEntry(): Promise<{ id: string }> {
    const { entryWriter } = getRepositories()
    const entry = await entryWriter.create(TEST_USER_ID, {
      kind: 'Expense',
      amount: cents(1000),
      date: isoDate('2026-07-10'),
      status: 'Paid',
      recurrenceId: null,
      entity: 'PF',
      categoryId: fixture.expenseCategoryId,
      classification: 'Current',
      bankAccountId: fixture.pfAccountId,
    })
    return { id: entry.id }
  }

  describe('GET', () => {
    it('reads a stored entry', async () => {
      const { id } = await createEntry()
      const response = await GET(new Request(`https://x/api/v1/entries/${id}`), params(id))
      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({ id, amount: 1000 })
    })

    it('404s for an id that does not exist', async () => {
      const response = await GET(new Request('https://x/api/v1/entries/none'), params('none'))
      expect(response.status).toBe(404)
    })
  })

  describe('PATCH', () => {
    it('edits a field and keeps the rest', async () => {
      const { id } = await createEntry()
      const response = await PATCH(
        jsonRequest(`https://x/api/v1/entries/${id}`, 'PATCH', { kind: 'Expense', amount: 5000 }),
        params(id),
      )
      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({
        id,
        amount: 5000,
        categoryId: fixture.expenseCategoryId,
      })
    })

    it('trocar só a categoria não muda status, entidade nem classificação (o PATCH não aplica os padrões do formulário de criação)', async () => {
      // Medido em 2026-10-01: `{kind, categoryId}` — o corpo que o DRE manda ao
      // categorizar (dre-category-entries.tsx) — chegava ao handler como
      // status "Paid", entity "PF" e classification "Current", os `.default()`
      // do schema de criação que o `.partial()` mantinha. Uma compra do cartão
      // Prevista virava Paga ao ser categorizada, e uma despesa PJ virava PF.
      const { entryWriter } = getRepositories()
      const prevista = await entryWriter.create(TEST_USER_ID, {
        kind: 'Expense',
        amount: cents(1000),
        date: isoDate('2026-07-10'),
        status: 'Planned',
        recurrenceId: null,
        entity: 'PJ',
        categoryId: fixture.expenseCategoryId,
        classification: 'NonCurrent',
        bankAccountId: fixture.pjAccountId,
      })
      const response = await PATCH(
        jsonRequest(`https://x/api/v1/entries/${prevista.id}`, 'PATCH', {
          kind: 'Expense',
          categoryId: fixture.expenseCategoryId,
        }),
        params(prevista.id),
      )
      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({
        status: 'Planned',
        entity: 'PJ',
        classification: 'NonCurrent',
      })
    })

    it('src/api/contracts/entries.ts — 409 when the patch tries to change the natureza', async () => {
      const { id } = await createEntry()
      const response = await PATCH(
        jsonRequest(`https://x/api/v1/entries/${id}`, 'PATCH', {
          kind: 'ProLabore',
          amount: 1000,
        }),
        params(id),
      )
      expect(response.status).toBe(409)
    })

    it('404s for an id that does not exist', async () => {
      const response = await PATCH(
        jsonRequest('https://x/api/v1/entries/none', 'PATCH', { kind: 'Expense', amount: 1 }),
        params('none'),
      )
      expect(response.status).toBe(404)
    })

    it('422s a malformed patch body', async () => {
      const { id } = await createEntry()
      const response = await PATCH(
        jsonRequest(`https://x/api/v1/entries/${id}`, 'PATCH', {
          kind: 'Expense',
          amount: 'not-a-number',
        }),
        params(id),
      )
      expect(response.status).toBe(422)
    })
  })

  describe('DELETE', () => {
    it('removes a stored entry', async () => {
      const { id } = await createEntry()
      const response = await DELETE(new Request(`https://x/api/v1/entries/${id}`), params(id))
      expect(response.status).toBe(204)

      const after = await GET(new Request(`https://x/api/v1/entries/${id}`), params(id))
      expect(after.status).toBe(404)
    })

    it('404s for an id that does not exist', async () => {
      const response = await DELETE(new Request('https://x/api/v1/entries/none'), params('none'))
      expect(response.status).toBe(404)
    })
  })

  describe('PATCH — Sub-tipo e Status de lançamento recorrente (2026-09-23)', () => {
    async function recurringProLabore(): Promise<{ id: string; recurrenceId: string }> {
      const response = await createEntryRoute(
        jsonRequest('https://x/api/v1/entries', 'POST', {
          kind: 'ProLabore',
          amount: 2_300_000,
          date: '2026-10-09',
          status: 'Paid',
          destinationAccountId: fixture.pfAccountId,
          recurrence: { amountKind: 'Fixed', endsOn: null },
        }),
      )
      return (await response.json()) as { id: string; recurrenceId: string }
    }

    it('troca Pró-labore → Distribuição de lucro, e a série troca junto', async () => {
      const { id, recurrenceId } = await recurringProLabore()
      const response = await PATCH(
        jsonRequest(`https://x/api/v1/entries/${id}`, 'PATCH', { kind: 'ProfitDistribution' }),
        params(id),
      )
      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({ kind: 'ProfitDistribution' })

      const { recurrenceReader } = getRepositories()
      const series = await recurrenceReader.findById(TEST_USER_ID, recurrenceId as never)
      expect(series?.template.kind).toBe('ProfitDistribution')
    })

    // ADR-0019: recorrente Previsto é OCORRÊNCIA, não lançamento. Voltar um
    // pagamento recorrente para Previsto devolve o mês à Revisão de Recorrentes
    // — deixar um lançamento Previsto ao lado da ocorrência contaria em dobro.
    it('ADR-0019 — recorrente Pago que volta a Previsto vira de novo a ocorrência do mês', async () => {
      const { id } = await recurringProLabore()
      const response = await PATCH(
        jsonRequest(`https://x/api/v1/entries/${id}`, 'PATCH', {
          kind: 'ProLabore',
          status: 'Planned',
        }),
        params(id),
      )
      expect(response.status).toBe(200)

      const { entryReader, occurrenceReader } = getRepositories()
      expect(await entryReader.findById(TEST_USER_ID, id as never)).toBeNull()
      const october = await occurrenceReader.listByMonth(TEST_USER_ID, '2026-10' as never)
      expect(october).toEqual([
        expect.objectContaining({
          status: 'Planned',
          entryId: null,
          plannedDate: '2026-10-09',
          plannedAmount: 2_300_000,
          discarded: false,
        }),
      ])
    })

    it('lançamento avulso Pago → Previsto continua um lançamento (sem série, sem ocorrência)', async () => {
      const { id } = await createEntry()
      const response = await PATCH(
        jsonRequest(`https://x/api/v1/entries/${id}`, 'PATCH', {
          kind: 'Expense',
          status: 'Planned',
        }),
        params(id),
      )
      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({ id, status: 'Planned' })
    })
  })

  /**
   * "Descartar lançamento" (pedido de produto, 2026-09-23). Um lançamento pago
   * pela Revisão de Recorrentes é apontado pela ocorrência do mês
   * (`occurrences.entry_id`, RESTRICT), e o DELETE respondia 409: a pessoa não
   * tinha como tirar um pagamento lançado por engano.
   */
  describe('DELETE de lançamento de recorrência', () => {
    async function paidOccurrenceEntry(): Promise<{
      entryId: string
      occurrenceId: string
      recurrenceId: string
    }> {
      const { recurrenceWriter, occurrenceReader } = getRepositories()
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
      await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-07'))
      const [occurrence] = await occurrenceReader.listByMonth(TEST_USER_ID, '2026-07' as never)
      const paid = await payOccurrence(
        jsonRequest(`https://x/api/v1/occurrences/${occurrence!.id}/payment`, 'POST', {
          paidAmount: 150_000,
          paymentDate: '2026-07-12',
        }),
        params(occurrence!.id),
      )
      const body = (await paid.json()) as { entryId: string }
      return { entryId: body.entryId, occurrenceId: occurrence!.id, recurrenceId: recurrence.id }
    }

    it('descarta o lançamento pago pela Revisão e descarta a ocorrência daquele mês', async () => {
      const { entryId, occurrenceId } = await paidOccurrenceEntry()

      const response = await DELETE(
        new Request(`https://x/api/v1/entries/${entryId}`),
        params(entryId),
      )
      expect(response.status).toBe(204)

      const { occurrenceReader, entryReader } = getRepositories()
      expect(await entryReader.findById(TEST_USER_ID, entryId as never)).toBeNull()
      // O mês some da série (Descartar = pula só este mês), sem voltar como
      // Previsto — senão a Revisão pediria de novo o pagamento recém-apagado.
      expect(await occurrenceReader.findById(TEST_USER_ID, occurrenceId as never)).toMatchObject({
        entryId: null,
        status: 'Planned',
        discarded: true,
      })
    })

    it('com encerrarRecorrencia, encerra a série na data do lançamento', async () => {
      const { entryId, recurrenceId } = await paidOccurrenceEntry()

      const response = await DELETE(
        new Request(`https://x/api/v1/entries/${entryId}?closeRecurrence=true`),
        params(entryId),
      )
      expect(response.status).toBe(204)

      const { recurrenceReader } = getRepositories()
      const recurrence = await recurrenceReader.findById(TEST_USER_ID, recurrenceId as never)
      expect(recurrence?.closedOn).toBe('2026-07-12')
    })

    it('com encerrarRecorrencia, ocorrência já materializada depois dele sai da Revisão', async () => {
      const { entryId } = await paidOccurrenceEntry()
      await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-09'))

      await DELETE(
        new Request(`https://x/api/v1/entries/${entryId}?closeRecurrence=true`),
        params(entryId),
      )

      const response = await occurrencesGET(
        new Request('https://x/api/v1/occurrences?month=2026-09'),
      )
      await expect(response.json()).resolves.toMatchObject({ data: [] })
    })

    it('sem encerrarRecorrencia, a série continua aberta', async () => {
      const { entryId, recurrenceId } = await paidOccurrenceEntry()
      await DELETE(new Request(`https://x/api/v1/entries/${entryId}`), params(entryId))

      const { recurrenceReader } = getRepositories()
      expect(
        (await recurrenceReader.findById(TEST_USER_ID, recurrenceId as never))?.closedOn,
      ).toBeNull()
    })
  })
})

describe('PATCH /api/v1/entries/{id} — "Desfazer" (Pago → Previsto, dono 2026-10-06)', () => {
  let handle: TestRepositories
  let fixture: EntriesTestFixture

  beforeEach(async () => {
    handle = useTestRepositories()
    fixture = await seedEntriesFixture(TEST_USER_ID)
  })

  afterEach(() => {
    handle.teardown()
  })

  async function planned(amount = 1000) {
    return getRepositories().entryWriter.create(TEST_USER_ID, {
      kind: 'Expense',
      amount: cents(amount),
      date: isoDate('2026-07-10'),
      status: 'Planned',
      recurrenceId: null,
      entity: 'PF',
      categoryId: fixture.expenseCategoryId,
      classification: 'Current',
      bankAccountId: fixture.pfAccountId,
    })
  }

  const undo = (id: string) =>
    PATCH(
      jsonRequest(`https://x/api/v1/entries/${id}`, 'PATCH', {
        kind: 'Expense',
        status: 'Planned',
      }),
      params(id),
    )

  it('dono 2026-10-06 — "Desfazer" volta a Previsto mantendo a data e o valor pagos', async () => {
    const entry = await planned()
    await payEntry(
      jsonRequest(`https://x/api/v1/entries/${entry.id}/payment`, 'POST', {
        paidAmount: 1200,
        paymentDate: '2026-07-14',
      }),
      params(entry.id),
    )
    const response = await undo(entry.id)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      status: 'Planned',
      date: '2026-07-14',
      amount: 1200,
    })
  })

  it('dono 2026-10-06 — "Desfazer" é recusado (409) no que veio do banco', async () => {
    const { entryWriter, importedTransactionWriter } = getRepositories()
    const paid = await entryWriter.replace(TEST_USER_ID, { ...(await planned()), status: 'Paid' })
    await importedTransactionWriter.record(TEST_USER_ID, {
      transactionId: 'tx-sintetica' as never,
      accountId: 'conta-provedor-sintetica' as never,
      date: isoDate('2026-07-10'),
      amount: cents(1000),
      description: 'Transação sintética',
      outcome: 'Entry',
      entryId: paid.id,
      settledOn: null,
    })
    const response = await undo(paid.id)
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: 'entries.paid_by_bank' })
  })

  it('dono 2026-10-06 — desfazer um pagamento a menor tira a Pendência de divergência', async () => {
    const entry = await planned(1000)
    await payEntry(
      jsonRequest(`https://x/api/v1/entries/${entry.id}/payment`, 'POST', {
        paidAmount: 800,
        paymentDate: '2026-07-14',
      }),
      params(entry.id),
    )
    const { paymentDiscrepancyReader } = getRepositories()
    expect(await paymentDiscrepancyReader.listByStatus(TEST_USER_ID, 'Pending')).toHaveLength(1)
    await undo(entry.id)
    expect(await paymentDiscrepancyReader.listByStatus(TEST_USER_ID, 'Pending')).toHaveLength(0)
  })
})
