/**
 * `POST /api/v1/categories/{id}/archive` — "Descartar" on a category line
 * (Figma 44:43). Not a delete: the row stays, past Lançamentos still point at
 * its id (files_design/01 §3.1).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_BLOCKS,
  DEFAULT_CATEGORIES,
  DISCRETIONARY_CATEGORY_ID,
} from '@/domain/chart-of-accounts'
import {
  TEST_USER_ID,
  useTestRepositories,
  type TestRepositories,
} from '@/data/fixtures/test-repositories'
import { categorySchema } from '@/api/contracts/chart-of-accounts'
import { POST } from './route'

const archiveRequest = (id: string) =>
  new Request(`https://x/api/v1/categories/${id}/archive`, { method: 'POST' })
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

const ACADEMIA = DEFAULT_CATEGORIES.find((c) => c.name === 'Academia')!

let handle: TestRepositories

beforeEach(async () => {
  handle = useTestRepositories()
  await handle.repositories.statementBlockWriter.seed(TEST_USER_ID, DEFAULT_BLOCKS)
  await handle.repositories.categoryWriter.seed(TEST_USER_ID, DEFAULT_CATEGORIES)
})

afterEach(() => {
  handle.teardown()
})

describe('POST /api/v1/categories/{id}/archive', () => {
  it('archives without deleting — the row is still readable by id', async () => {
    const response = await POST(archiveRequest(ACADEMIA.id), ctx(ACADEMIA.id))

    expect(response.status).toBe(200)
    expect(categorySchema.parse(await response.json())).toMatchObject({
      id: ACADEMIA.id,
      archived: true,
    })
    await expect(
      handle.repositories.categoryReader.findById(TEST_USER_ID, ACADEMIA.id),
    ).resolves.toMatchObject({ archived: true })
    expect(await handle.repositories.categoryReader.count(TEST_USER_ID)).toBe(
      DEFAULT_CATEGORIES.length,
    )
  })

  it('is idempotent — archiving twice is not an error', async () => {
    await POST(archiveRequest(ACADEMIA.id), ctx(ACADEMIA.id))
    const second = await POST(archiveRequest(ACADEMIA.id), ctx(ACADEMIA.id))

    expect(second.status).toBe(200)
    await expect(second.json()).resolves.toMatchObject({ archived: true })
  })

  it('409s the system category — Consumo Livre cannot be discarded (P10)', async () => {
    const response = await POST(
      archiveRequest(DISCRETIONARY_CATEGORY_ID),
      ctx(DISCRETIONARY_CATEGORY_ID),
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'chart_of_accounts.system_category_is_fixed',
    })
    await expect(
      handle.repositories.categoryReader.findById(TEST_USER_ID, DISCRETIONARY_CATEGORY_ID),
    ).resolves.toMatchObject({ archived: false })
  })

  it('404s an id that is not this user’s, with no internals in the body', async () => {
    const response = await POST(archiveRequest('nao-existe'), ctx('nao-existe'))

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body).toMatchObject({ code: 'chart_of_accounts.unknown_category' })
    expect(JSON.stringify(body)).not.toMatch(/SQLITE|update |\/Users\/|at Object\./i)
  })
})
