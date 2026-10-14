/**
 * `GET /api/v1/pending-allocations`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { cents, isoDate } from '@/domain/core'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { GET } from './route'

describe('GET /api/v1/pending-allocations', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  it('starts empty, then filters by status', async () => {
    const asset = await handle.repositories.tangibleAssetWriter.create(TEST_USER_ID, {
      name: 'Moto',
      entity: 'PF',
      recordedValue: cents(2000000),
    })
    await handle.repositories.pendingAllocationWriter.create(TEST_USER_ID, {
      origin: { kind: 'TangibleAssetSale', tangibleAssetId: asset.id },
      amount: cents(50000),
      originDate: isoDate('2026-03-01'),
      status: 'Pending',
    })

    const all = await GET(new Request('https://x/api/v1/pending-allocations'))
    await expect(all.json()).resolves.toMatchObject({ meta: { total: 1 } })

    const allocated = await GET(
      new Request('https://x/api/v1/pending-allocations?status=Allocated'),
    )
    await expect(allocated.json()).resolves.toEqual({ data: [], meta: { total: 0 } })
  })

  it('rejects an unknown status value with 422', async () => {
    const response = await GET(new Request('https://x/api/v1/pending-allocations?status=Bogus'))
    expect(response.status).toBe(422)
  })
})
