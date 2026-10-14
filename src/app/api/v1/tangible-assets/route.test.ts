/**
 * `GET, POST /api/v1/tangible-assets`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { cents, isoDate } from '@/domain/core'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { GET, POST } from './route'

function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/v1/tangible-assets', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  it('creates an unsold bem material', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/tangible-assets', 'POST', {
        name: 'Carro',
        entity: 'PF',
        recordedValue: 8000000,
      }),
    )
    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      name: 'Carro',
      recordedValue: 8000000,
      soldOn: null,
    })
  })

  it('rejects a missing recordedValue with 422', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/tangible-assets', 'POST', { name: 'Carro', entity: 'PF' }),
    )
    expect(response.status).toBe(422)
  })
})

describe('GET /api/v1/tangible-assets', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  it('lists only unsold assets (files_design/01 §3.3, §10)', async () => {
    const kept = await handle.repositories.tangibleAssetWriter.create(TEST_USER_ID, {
      name: 'Apartamento',
      entity: 'PF',
      recordedValue: cents(50000000),
    })
    const sold = await handle.repositories.tangibleAssetWriter.create(TEST_USER_ID, {
      name: 'Moto velha',
      entity: 'PF',
      recordedValue: cents(1000000),
    })
    await handle.repositories.tangibleAssetWriter.replace(TEST_USER_ID, {
      ...sold,
      soldOn: isoDate('2026-01-10'),
    })

    const response = await GET(new Request('https://x/api/v1/tangible-assets'))
    const body = (await response.json()) as { data: Array<{ id: string }> }
    expect(body.data).toEqual([expect.objectContaining({ id: kept.id })])
  })

  /**
   * The money mask (files_design/03 "Convenção geral") starts at R$ 0,00 and
   * takes digits only, so no screen can send a negative — and a negative Bem
   * Material subtracts from the Ativo in the Balanço and inverts the ganho/perda
   * the sale computes.
   */
  it('rejects a negative recordedValue with 422', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/tangible-assets', 'POST', {
        name: 'Carro',
        entity: 'PF',
        recordedValue: -100,
      }),
    )
    expect(response.status).toBe(422)
  })
})
