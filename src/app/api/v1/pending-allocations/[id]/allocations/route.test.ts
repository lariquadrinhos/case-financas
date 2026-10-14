/**
 * `POST /api/v1/pending-allocations/{id}/allocations` — "Direcionar agora".
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { cents, isoDate } from '@/domain/core'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { POST } from './route'

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function context(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/v1/pending-allocations/{id}/allocations', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  async function seedPending() {
    const asset = await handle.repositories.tangibleAssetWriter.create(TEST_USER_ID, {
      name: 'Moto',
      entity: 'PF',
      recordedValue: cents(2000000),
    })
    return handle.repositories.pendingAllocationWriter.create(TEST_USER_ID, {
      origin: { kind: 'TangibleAssetSale', tangibleAssetId: asset.id },
      amount: cents(50000),
      originDate: isoDate('2026-03-01'),
      status: 'Pending',
    })
  }

  it('directs the whole pending amount and marks it Allocated', async () => {
    const pending = await seedPending()
    const response = await POST(
      jsonRequest(`https://x/api/v1/pending-allocations/${pending.id}/allocations`, {
        allocations: [{ kind: 'Revenue', amount: 50000 }],
      }),
      context(pending.id),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ status: 'Allocated' })
  })

  it('rejects allocations that do not sum to exactly the pending amount (422)', async () => {
    const pending = await seedPending()
    const response = await POST(
      jsonRequest(`https://x/api/v1/pending-allocations/${pending.id}/allocations`, {
        allocations: [{ kind: 'Revenue', amount: 40000 }],
      }),
      context(pending.id),
    )
    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      code: 'pending_allocation.allocations_do_not_match_amount',
    })
  })

  it('refuses to direct an already-allocated pendência (409)', async () => {
    const pending = await seedPending()
    await POST(
      jsonRequest(`https://x/api/v1/pending-allocations/${pending.id}/allocations`, {
        allocations: [{ kind: 'Revenue', amount: 50000 }],
      }),
      context(pending.id),
    )

    const secondAttempt = await POST(
      jsonRequest(`https://x/api/v1/pending-allocations/${pending.id}/allocations`, {
        allocations: [{ kind: 'Revenue', amount: 50000 }],
      }),
      context(pending.id),
    )
    expect(secondAttempt.status).toBe(409)
  })

  it('answers 404 for a pendência that does not exist', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/pending-allocations/ghost/allocations', {
        allocations: [{ kind: 'Revenue', amount: 100 }],
      }),
      context('ghost'),
    )
    expect(response.status).toBe(404)
  })

  it('rejects an empty allocations list with 422 — exception 2 does not apply here', async () => {
    const pending = await seedPending()
    const response = await POST(
      jsonRequest(`https://x/api/v1/pending-allocations/${pending.id}/allocations`, {
        allocations: [],
      }),
      context(pending.id),
    )
    expect(response.status).toBe(422)
  })

  /**
   * "Direcionar agora" closes the Pendência for good, so a target naming
   * nothing would resolve it with the value going nowhere — the same hole the
   * sale route had (files_design/03: Destino is an Investimento or Passivo
   * *existente*).
   */
  it('refuses a target that does not exist, leaving the Pendência open', async () => {
    const pending = await seedPending()

    const response = await POST(
      jsonRequest(`https://x/api/v1/pending-allocations/${pending.id}/allocations`, {
        allocations: [{ kind: 'Investment', target: 'ghost-investment', amount: 50000 }],
      }),
      context(pending.id),
    )

    expect(response.status).toBe(404)
    const stored = await handle.repositories.pendingAllocationReader.findById(
      TEST_USER_ID,
      pending.id,
    )
    expect(stored?.status).toBe('Pending')
  })
})
