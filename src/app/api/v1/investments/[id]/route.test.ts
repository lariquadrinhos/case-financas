/**
 * `GET, PATCH, DELETE /api/v1/investments/{id}`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { cents } from '@/domain/core'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { DELETE, GET, PATCH } from './route'

function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function context(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('GET, PATCH, DELETE /api/v1/investments/{id}', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  async function seed() {
    return handle.repositories.investmentWriter.create(TEST_USER_ID, {
      name: 'Tesouro Direto',
      entity: 'PF',
      accumulatedValue: cents(300000),
    })
  }

  it('GET reads it back; 404 for an unknown id', async () => {
    const investment = await seed()
    const ok = await GET(
      new Request(`https://x/api/v1/investments/${investment.id}`),
      context(investment.id),
    )
    expect(ok.status).toBe(200)

    const missing = await GET(new Request('https://x/api/v1/investments/ghost'), context('ghost'))
    expect(missing.status).toBe(404)
  })

  it('PATCH updates the accumulated value (a new aporte, UC11)', async () => {
    const investment = await seed()
    const response = await PATCH(
      jsonRequest(`https://x/api/v1/investments/${investment.id}`, 'PATCH', {
        accumulatedValue: 350000,
      }),
      context(investment.id),
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ accumulatedValue: 350000 })
  })

  it('DELETE removes it (UC38 — "descartar um investimento que não existe mais")', async () => {
    const investment = await seed()
    const response = await DELETE(
      new Request(`https://x/api/v1/investments/${investment.id}`, { method: 'DELETE' }),
      context(investment.id),
    )
    expect(response.status).toBe(204)
    expect(
      await handle.repositories.investmentReader.findById(TEST_USER_ID, investment.id),
    ).toBeNull()
  })
})
