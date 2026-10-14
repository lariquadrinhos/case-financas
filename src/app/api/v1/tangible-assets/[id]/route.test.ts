/**
 * `GET, PATCH, DELETE /api/v1/tangible-assets/{id}`.
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

describe('GET, PATCH, DELETE /api/v1/tangible-assets/{id}', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  async function seed() {
    return handle.repositories.tangibleAssetWriter.create(TEST_USER_ID, {
      name: 'Carro',
      entity: 'PF',
      recordedValue: cents(8000000),
    })
  }

  it('GET reads it back; 404 for an unknown id', async () => {
    const asset = await seed()
    const ok = await GET(
      new Request(`https://x/api/v1/tangible-assets/${asset.id}`),
      context(asset.id),
    )
    expect(ok.status).toBe(200)

    const missing = await GET(
      new Request('https://x/api/v1/tangible-assets/ghost'),
      context('ghost'),
    )
    expect(missing.status).toBe(404)
  })

  it('PATCH corrects the cadastro without touching soldOn', async () => {
    const asset = await seed()
    const response = await PATCH(
      jsonRequest(`https://x/api/v1/tangible-assets/${asset.id}`, 'PATCH', {
        name: 'Carro (revisado)',
      }),
      context(asset.id),
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ name: 'Carro (revisado)', soldOn: null })
  })

  it('DELETE removes the bem material; 404 for an unknown id', async () => {
    const asset = await seed()
    const response = await DELETE(
      new Request(`https://x/api/v1/tangible-assets/${asset.id}`, { method: 'DELETE' }),
      context(asset.id),
    )
    expect(response.status).toBe(204)

    const missing = await DELETE(
      new Request('https://x/api/v1/tangible-assets/ghost', { method: 'DELETE' }),
      context('ghost'),
    )
    expect(missing.status).toBe(404)
  })
})
