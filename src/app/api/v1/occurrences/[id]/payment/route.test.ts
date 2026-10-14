/**
 * `POST /api/v1/occurrences/{id}/payment` — "Marcar Pago" on a recurrence
 * occurrence. Unlike `/api/v1/entries/{id}/payment`, this CREATES the
 * Lançamento: covers that creation, the not-found path and the conflict of
 * paying an occurrence that is no longer "em aberto".
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getRepositories } from '@/data'
import { seedEntriesFixture, type EntriesTestFixture } from '@/data/fixtures/entries-test-fixtures'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { POST } from './route'
import { GET as occurrencesGET } from '../../route'

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/v1/occurrences/{id}/payment', () => {
  let handle: TestRepositories
  let fixture: EntriesTestFixture

  beforeEach(async () => {
    handle = useTestRepositories()
    fixture = await seedEntriesFixture(TEST_USER_ID)
  })

  afterEach(() => {
    handle.teardown()
  })

  async function occurrenceIdOf(
    month: string,
    amountKind: 'Fixed' | 'ToBeDefined' = 'Fixed',
  ): Promise<string> {
    const { recurrenceWriter, occurrenceReader } = getRepositories()
    await recurrenceWriter.create(TEST_USER_ID, {
      template: {
        kind: 'Expense',
        amount: amountKind === 'Fixed' ? 150_000 : 0,
        entity: 'PF',
        categoryId: fixture.expenseCategoryId,
        classification: 'Current',
        bankAccountId: fixture.pfAccountId,
      },
      amountKind,
      startDate: '2026-01-10',
      endsOn: null,
    } as never)
    await occurrencesGET(new Request(`https://x/api/v1/occurrences?month=${month}`))
    const [occurrence] = await occurrenceReader.listByMonth(TEST_USER_ID, month as never)
    return occurrence!.id
  }

  it('medido em 2026-10-06 — "Confirmar" no DRE paga a ocorrência projetada, sem visita à Revisão', async () => {
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
    const projected = `${recurrence.id}:2026-10`
    const response = await POST(
      jsonRequest(`https://x/api/v1/occurrences/${projected}/payment`, {
        paidAmount: 150_000,
        paymentDate: '2026-10-10',
      }),
      params(projected),
    )
    expect(response.status).toBe(200)
  })

  it('creates the Lançamento and marks the occurrence Paga with the entry it produced', async () => {
    const id = await occurrenceIdOf('2026-07')
    const response = await POST(
      jsonRequest(`https://x/api/v1/occurrences/${id}/payment`, {
        paidAmount: 150_000,
        paymentDate: '2026-07-12',
      }),
      params(id),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      status: string
      entryId: string | null
      plannedAmount: number
    }
    expect(body.status).toBe('Paid')
    expect(body.plannedAmount).toBe(150_000)
    expect(body.entryId).toBeTruthy()

    const { entryReader } = getRepositories()
    const entry = await entryReader.findById(TEST_USER_ID, body.entryId as never)
    expect(entry).toMatchObject({ amount: 150_000, date: '2026-07-12', status: 'Paid' })

    // Exact match: an Evento "RecurrencePaid", never a Pendência (Event Storming Fluxo J).
    const { traceEventReader, paymentDiscrepancyReader } = getRepositories()
    const events = await traceEventReader.listRecent(TEST_USER_ID)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ kind: 'RecurrencePaid', origin: { kind: 'Recurrence' } })
    expect(await paymentDiscrepancyReader.listByStatus(TEST_USER_ID, 'Pending')).toEqual([])
  })

  it('PRD §5 — a "a definir" occurrence paid for the first time has no planned value to diverge from', async () => {
    const id = await occurrenceIdOf('2026-07', 'ToBeDefined')
    const response = await POST(
      jsonRequest(`https://x/api/v1/occurrences/${id}/payment`, {
        paidAmount: 80_000,
        paymentDate: '2026-07-12',
      }),
      params(id),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { plannedAmount: number }
    expect(body.plannedAmount).toBe(80_000)

    // Nothing to diverge from: no Evento, no Pendência (payOccurrence's outcome is null).
    const { traceEventReader } = getRepositories()
    expect(await traceEventReader.listRecent(TEST_USER_ID)).toEqual([])
  })

  it('Event Storming Fluxo J — paying LESS than planned logs a Discrepancy Evento and opens a Pendência', async () => {
    const id = await occurrenceIdOf('2026-07')
    const response = await POST(
      jsonRequest(`https://x/api/v1/occurrences/${id}/payment`, {
        paidAmount: 130_000,
        paymentDate: '2026-07-12',
      }),
      params(id),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { entryId: string }

    const { traceEventReader, paymentDiscrepancyReader } = getRepositories()
    const events = await traceEventReader.listRecent(TEST_USER_ID)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ kind: 'Discrepancy', origin: { kind: 'Recurrence' } })

    const discrepancies = await paymentDiscrepancyReader.listByStatus(TEST_USER_ID, 'Pending')
    expect(discrepancies).toHaveLength(1)
    expect(discrepancies[0]).toMatchObject({
      origin: { kind: 'Entry', entryId: body.entryId },
      shortfall: 20_000,
      status: 'Pending',
    })
  })

  it('404s for an id that does not exist', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/occurrences/none/payment', {
        paidAmount: 100,
        paymentDate: '2026-07-12',
      }),
      params('none'),
    )
    expect(response.status).toBe(404)
  })

  it('src/domain/recurrence/payment.ts payOccurrence — 409 paying an occurrence already Paga', async () => {
    const id = await occurrenceIdOf('2026-07')
    await POST(
      jsonRequest(`https://x/api/v1/occurrences/${id}/payment`, {
        paidAmount: 150_000,
        paymentDate: '2026-07-12',
      }),
      params(id),
    )
    const second = await POST(
      jsonRequest(`https://x/api/v1/occurrences/${id}/payment`, {
        paidAmount: 150_000,
        paymentDate: '2026-07-13',
      }),
      params(id),
    )
    expect(second.status).toBe(409)
  })

  it('422s a negative paidAmount at the schema border', async () => {
    const id = await occurrenceIdOf('2026-07')
    const response = await POST(
      jsonRequest(`https://x/api/v1/occurrences/${id}/payment`, {
        paidAmount: -1,
        paymentDate: '2026-07-12',
      }),
      params(id),
    )
    expect(response.status).toBe(422)
  })

  // ADR-0014 — four ports, one unit of work. Before the fix this left an
  // orphan Lançamento (created) with the occurrence still Previsto and no
  // Pendência — proving the bug the seam exists to close, not just the fix.
  it('ADR-0014 — an underpaid occurrence payment is all-or-nothing across all four writes', async () => {
    const id = await occurrenceIdOf('2026-07')
    const {
      paymentDiscrepancyWriter,
      occurrenceReader,
      entryReader,
      traceEventReader,
      paymentDiscrepancyReader,
    } = getRepositories()

    const boom = new Error('boom — simulated failure of the fourth write in the unit of work')
    vi.spyOn(paymentDiscrepancyWriter, 'create').mockRejectedValueOnce(boom)

    const before = await entryReader.list(TEST_USER_ID, {
      status: null,
      view: null,
      month: null,
      categoryId: null,
      classification: null,
      bankAccountId: null,
      recurring: null,
    } as never)

    const response = await POST(
      jsonRequest(`https://x/api/v1/occurrences/${id}/payment`, {
        paidAmount: 130_000,
        paymentDate: '2026-07-12',
      }),
      params(id),
    )

    expect(response.status).toBe(500)

    // No orphan Lançamento left behind by the entryWriter.create() that ran
    // earlier in the SAME transaction.
    const after = await entryReader.list(TEST_USER_ID, {
      status: null,
      view: null,
      month: null,
      categoryId: null,
      classification: null,
      bankAccountId: null,
      recurring: null,
    } as never)
    expect(after).toHaveLength(before.length)

    const occurrence = await occurrenceReader.findById(TEST_USER_ID, id as never)
    expect(occurrence).toMatchObject({ status: 'Planned', entryId: null })
    expect(await traceEventReader.listRecent(TEST_USER_ID)).toEqual([])
    expect(await paymentDiscrepancyReader.listByStatus(TEST_USER_ID, 'Pending')).toEqual([])
  })
})

/**
 * ADR-0017 §5 — "Descontar da próxima ocorrência".
 *
 * O `overpaymentChoice` era aceito pelo schema e ignorado desde que existe, com
 * o comentário da rota apontando para o H12: "registrar a escolha sem ter onde
 * gastá-la seria um no-op silencioso". Com o §4 feito, passou a ter onde.
 *
 * As recusas são validadas ANTES da transação de propósito: recusar depois de
 * gravar o pagamento deixaria a pessoa com o pagamento no banco e um erro na
 * tela, e reenviar gravaria o pagamento duas vezes. Por isso cada teste de
 * recusa confere que a ocorrência continua Previsto.
 */
describe('POST /api/v1/occurrences/{id}/payment — DeductFromNext (ADR-0017 §5)', () => {
  let handle: TestRepositories
  let fixture: EntriesTestFixture

  beforeEach(async () => {
    handle = useTestRepositories()
    fixture = await seedEntriesFixture(TEST_USER_ID)
  })

  afterEach(() => {
    handle.teardown()
  })

  async function serie(endsOn: string | null, amountKind: 'Fixed' | 'ToBeDefined' = 'Fixed') {
    const { recurrenceWriter, occurrenceReader } = getRepositories()
    const recorrencia = await recurrenceWriter.create(TEST_USER_ID, {
      template: {
        kind: 'Expense',
        amount: amountKind === 'Fixed' ? 150_000 : 0,
        entity: 'PF',
        categoryId: fixture.expenseCategoryId,
        classification: 'Current',
        bankAccountId: fixture.pfAccountId,
      },
      amountKind,
      startDate: '2026-01-10',
      endsOn,
    } as never)
    await occurrencesGET(new Request('https://x/api/v1/occurrences?month=2026-09'))
    const [ocorrencia] = await occurrenceReader.listByMonth(TEST_USER_ID, '2026-09' as never)
    return { recorrencia, ocorrenciaId: ocorrencia!.id }
  }

  const pagar = (id: string, pago: number, escolha: string) =>
    POST(
      jsonRequest(`https://x/api/v1/occurrences/${id}/payment`, {
        paidAmount: pago,
        paymentDate: '2026-09-11',
        overpaymentChoice: escolha,
      }),
      params(id),
    )

  it('reduz o previsto do mês seguinte pelo excesso', async () => {
    const { recorrencia, ocorrenciaId } = await serie(null)

    const response = await pagar(ocorrenciaId, 170_000, 'DeductFromNext')
    expect(response.status).toBe(200)

    const { occurrenceReader } = getRepositories()
    const proxima = await occurrenceReader.findById(
      TEST_USER_ID,
      `${recorrencia.id}:2026-10` as never,
    )
    // 150.000 previstos − 20.000 de excesso.
    expect(proxima?.plannedAmount).toBe(130_000)
  })

  it('recusa quando a série acaba neste mês, e não grava o pagamento', async () => {
    const { ocorrenciaId } = await serie('2026-09-30')

    const response = await pagar(ocorrenciaId, 170_000, 'DeductFromNext')
    expect(response.status).toBe(409)

    const { occurrenceReader } = getRepositories()
    const ocorrencia = await occurrenceReader.findById(TEST_USER_ID, ocorrenciaId as never)
    expect(ocorrencia?.status).toBe('Planned')
  })

  it('recusa quando o desconto não cabe no mês seguinte', async () => {
    const { ocorrenciaId } = await serie(null)

    const response = await pagar(ocorrenciaId, 500_000, 'DeductFromNext')
    expect(response.status).toBe(409)
  })

  it('"Manter sem ação" continua não mexendo no mês seguinte', async () => {
    const { recorrencia, ocorrenciaId } = await serie(null)

    expect((await pagar(ocorrenciaId, 170_000, 'NoAction')).status).toBe(200)

    const { occurrenceReader } = getRepositories()
    const proxima = await occurrenceReader.findById(
      TEST_USER_ID,
      `${recorrencia.id}:2026-10` as never,
    )
    // Nem materializada: só a visita ao mês materializa (ADR-0004).
    expect(proxima).toBeNull()
  })
})
