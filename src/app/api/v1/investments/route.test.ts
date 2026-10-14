/**
 * `GET, POST /api/v1/investments`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useTestRepositories, type TestRepositories } from '@/data/fixtures/test-repositories'
import { GET, POST } from './route'

function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
  })
}

describe('POST /api/v1/investments', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  it('creates an investment and answers 201 with a Location header', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/investments', 'POST', {
        name: 'Tesouro Direto',
        entity: 'PF',
        accumulatedValue: 300000,
      }),
    )
    expect(response.status).toBe(201)
    expect(response.headers.get('location')).toMatch(/^\/api\/v1\/investments\/.+/)
    await expect(response.json()).resolves.toMatchObject({
      name: 'Tesouro Direto',
      accumulatedValue: 300000,
    })
  })

  it('rejects a missing name with 422', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/investments', 'POST', { entity: 'PF', accumulatedValue: 1000 }),
    )
    expect(response.status).toBe(422)
  })
})

describe('GET /api/v1/investments', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  it('filters by entity', async () => {
    await POST(
      jsonRequest('https://x/api/v1/investments', 'POST', {
        name: 'CDB PF',
        entity: 'PF',
        accumulatedValue: 1000,
      }),
    )
    await POST(
      jsonRequest('https://x/api/v1/investments', 'POST', {
        name: 'CDB PJ',
        entity: 'PJ',
        accumulatedValue: 2000,
      }),
    )

    const pf = await GET(new Request('https://x/api/v1/investments?entity=PF'))
    const body = (await pf.json()) as { data: Array<{ name: string }> }
    expect(body.data).toEqual([
      { id: expect.any(String), name: 'CDB PF', entity: 'PF', accumulatedValue: 1000 },
    ])
  })

  /** Saldo inicial + aportes acumulados: a sum of non-negative parts (PRD §1). */
  it('rejects a negative accumulatedValue with 422', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/investments', 'POST', {
        name: 'CDB',
        entity: 'PF',
        accumulatedValue: -100,
      }),
    )
    expect(response.status).toBe(422)
  })
})
