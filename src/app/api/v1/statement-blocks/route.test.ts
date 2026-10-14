/**
 * `GET /api/v1/statement-blocks` — the 10 fixed blocks of the DRE.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { BLOCK_IDS, DEFAULT_BLOCKS } from '@/domain/chart-of-accounts'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { statementBlockSchema } from '@/api/contracts/chart-of-accounts'
import { listEnvelope } from '@/api/contracts/common'
import { GET } from './route'

let handle: TestRepositories

beforeEach(() => {
  handle = useTestRepositories()
})

afterEach(() => {
  handle.teardown()
})

describe('GET /api/v1/statement-blocks', () => {
  it('lists the 10 blocks in cascade order, matching the contract schema', async () => {
    await handle.repositories.statementBlockWriter.seed(TEST_USER_ID, DEFAULT_BLOCKS)

    const response = await GET(new Request('https://x/api/v1/statement-blocks'))

    expect(response.status).toBe(200)
    const parsed = listEnvelope(statementBlockSchema).parse(await response.json())
    expect(parsed.meta.total).toBe(10)
    expect(parsed.data.map((b) => b.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(parsed.data.map((b) => b.id)).toEqual(DEFAULT_BLOCKS.map((b) => b.id))
  })

  it('D&A is the one block that accepts no category, and block 10 is the one below the line', async () => {
    await handle.repositories.statementBlockWriter.seed(TEST_USER_ID, DEFAULT_BLOCKS)

    const body = (await (await GET(new Request('https://x/api/v1/statement-blocks'))).json()) as {
      data: { id: string; acceptsUserCategories: boolean; belowTheLine: boolean }[]
    }

    expect(body.data.filter((b) => !b.acceptsUserCategories).map((b) => b.id)).toEqual([
      BLOCK_IDS.depreciationAndAmortization,
    ])
    expect(body.data.filter((b) => b.belowTheLine).map((b) => b.id)).toEqual([
      BLOCK_IDS.profitAllocation,
    ])
  })

  it('answers an empty envelope, not an error, before onboarding has seeded anything', async () => {
    const response = await GET(new Request('https://x/api/v1/statement-blocks'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: [], meta: { total: 0 } })
  })
})
