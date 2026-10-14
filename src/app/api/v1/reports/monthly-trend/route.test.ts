/**
 * `GET /api/v1/reports/monthly-trend` — Evolução Mensal (files_design/01
 * §8.3). Integration test against the real SQLite adapter: happy path
 * (only-months-with-data, PRD "mostra apenas os meses com dado real") and
 * query validation. No id param, so no not-found path.
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

function get(query: string): Request {
  return new Request(`https://x/api/v1/reports/monthly-trend?${query}`)
}

describe('GET /api/v1/reports/monthly-trend', () => {
  let handle: TestRepositories
  let fixture: EntriesTestFixture

  beforeEach(async () => {
    handle = useTestRepositories()
    fixture = await seedEntriesFixture(TEST_USER_ID)
  })

  afterEach(() => {
    handle.teardown()
  })

  it('UC9 — shows only the months with real data, earliest first, with netWorth as-of the window end', async () => {
    const { entryWriter, bankAccountWriter } = getRepositories()
    // Give the current position a real balance so `netWorth` at `asOf` is not
    // just zero minus zero — makes the backward walk (P21) worth asserting on.
    await bankAccountWriter.create(TEST_USER_ID, {
      label: 'Conta PF extra',
      colour: 'itau',
      entity: 'PF',
      balance: cents(2_000_000),
    })
    await entryWriter.create(TEST_USER_ID, {
      kind: 'Revenue',
      amount: cents(500_000),
      date: isoDate('2026-05-10'),
      status: 'Paid',
      recurrenceId: null,
      entity: 'PF',
      categoryId: asId<CategoryId>('salario-pro-labore'),
      classification: 'Current',
      bankAccountId: fixture.pfAccountId,
    })
    await entryWriter.create(TEST_USER_ID, {
      kind: 'Revenue',
      amount: cents(600_000),
      date: isoDate('2026-07-10'),
      status: 'Paid',
      recurrenceId: null,
      entity: 'PF',
      categoryId: asId<CategoryId>('salario-pro-labore'),
      classification: 'Current',
      bankAccountId: fixture.pfAccountId,
    })
    // June has nothing — the range still spans it, but it must not appear.

    const response = await GET(
      get('view=Consolidated&range=LastSixMonths&until=2026-07&asOf=2026-07-31'),
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      points: Array<{ month: string; revenue: number; netWorth: number }>
    }
    expect(body.points.map((p) => p.month)).toEqual(['2026-05', '2026-07'])
    expect(body.points[0]?.revenue).toBe(500_000)
    expect(body.points[1]?.revenue).toBe(600_000)
    // Total current position: 2.000.000 (extra account) + 0 (fixture accounts).
    expect(body.points[1]?.netWorth).toBe(2_000_000)
  })

  it('defaults range to "Últimos 6 meses" when omitted', async () => {
    const response = await GET(get('view=Consolidated&until=2026-07&asOf=2026-07-31'))
    expect(response.status).toBe(200)
    const body = (await response.json()) as { range: string }
    expect(body.range).toBe('LastSixMonths')
  })

  it('answers an empty series when no month in the window has activity', async () => {
    const response = await GET(
      get('view=Consolidated&range=LastSixMonths&until=2026-07&asOf=2026-07-31'),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { points: unknown[] }
    expect(body.points).toEqual([])
  })

  it('rejects a request missing until with 422', async () => {
    const response = await GET(get('view=Consolidated&asOf=2026-07-31'))
    expect(response.status).toBe(422)
  })

  /**
   * P21: `currentNetWorth` é a foto do Balanço em `asOf`, e a série inteira é
   * reconstruída pra trás A PARTIR dela — `computeMonthlyTrend` documenta esse
   * input como "as of now (`until`'s end)". Se `asOf` cair fora do mês
   * `until`, o patrimônio de HOJE é atribuído ao fim de um mês passado e todos
   * os pontos anteriores herdam o erro, sem aviso: a série fica errada por
   * todo o lucro apurado entre os dois.
   *
   * A tela sempre manda os dois coerentes (`todayMonth()`/`todayIsoDate()`),
   * mas o contrato aceitava qualquer par — e nada quebrava.
   */
  it('P21 — rejeita com 422 um asOf fora do mês de until', async () => {
    const response = await GET(
      get('view=Consolidated&range=LastSixMonths&until=2026-05&asOf=2026-09-20'),
    )
    expect(response.status).toBe(422)
  })

  it('rejects an unknown range with 422', async () => {
    const response = await GET(
      get('view=Consolidated&range=LastCentury&until=2026-07&asOf=2026-07-31'),
    )
    expect(response.status).toBe(422)
  })
})
