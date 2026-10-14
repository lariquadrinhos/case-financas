/**
 * `GET, POST /api/v1/categories` — the editable half of the Plano de Contas.
 *
 * Every case here asserts. The file that stood here before printed each
 * response to `console.error` and asserted nothing: removing the D&A read-only
 * guard from `createCategory` left all 16 of its cases green while the route
 * happily answered 201 for a block that accepts no categories.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  BLOCK_IDS,
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
import { listEnvelope } from '@/api/contracts/common'
import { GET, POST } from './route'

function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { 'content-type': 'application/json' },
  })
}

const CATEGORIES_URL = 'https://x/api/v1/categories'

let handle: TestRepositories

beforeEach(async () => {
  handle = useTestRepositories()
  await handle.repositories.statementBlockWriter.seed(TEST_USER_ID, DEFAULT_BLOCKS)
  await handle.repositories.categoryWriter.seed(TEST_USER_ID, DEFAULT_CATEGORIES)
})

afterEach(() => {
  handle.teardown()
})

describe('POST /api/v1/categories — UC16', () => {
  it('creates a category inside a block and points Location at it', async () => {
    const response = await POST(
      jsonRequest(CATEGORIES_URL, 'POST', {
        blockId: BLOCK_IDS.personalExpenses,
        name: 'Cafés',
      }),
    )

    expect(response.status).toBe(201)
    const body = await response.json()
    // The response IS the contract the OpenAPI document was generated from.
    expect(categorySchema.parse(body)).toMatchObject({
      blockId: BLOCK_IDS.personalExpenses,
      name: 'Cafés',
      isSystem: false,
      suggestedClassification: null,
      archived: false,
    })
    expect(response.headers.get('location')).toBe(
      `/api/v1/categories/${(body as { id: string }).id}`,
    )
    // And it is really stored, under this user.
    const stored = await handle.repositories.categoryReader.findById(
      TEST_USER_ID,
      (body as { id: string }).id as never,
    )
    expect(stored).not.toBeNull()
  })

  it('the writer assigns the id — a client-supplied one is an unknown field (ADR-0009)', async () => {
    const response = await POST(
      jsonRequest(CATEGORIES_URL, 'POST', {
        id: 'chosen-by-the-client',
        blockId: BLOCK_IDS.personalExpenses,
        name: 'Cafés',
      }),
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({ code: 'request.invalid' })
  })

  it('rejects an unknown field instead of dropping it (.strict())', async () => {
    const response = await POST(
      jsonRequest(CATEGORIES_URL, 'POST', {
        blockId: BLOCK_IDS.personalExpenses,
        name: 'Cafés',
        archived: true,
      }),
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      code: 'request.invalid',
      errors: [{ code: 'unrecognized_keys' }],
    })
  })

  it('422s the D&A block, the one that accepts no category (Figma 51:32)', async () => {
    const response = await POST(
      jsonRequest(CATEGORIES_URL, 'POST', {
        blockId: BLOCK_IDS.depreciationAndAmortization,
        name: 'Depreciação do carro',
      }),
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      code: 'chart_of_accounts.block_refuses_categories',
    })
    expect(await handle.repositories.categoryReader.count(TEST_USER_ID)).toBe(
      DEFAULT_CATEGORIES.length,
    )
  })

  it('409s a name already used in the same block, accent- and case-insensitively (Figma 48:21)', async () => {
    const response = await POST(
      jsonRequest(CATEGORIES_URL, 'POST', {
        blockId: BLOCK_IDS.personalExpenses,
        name: 'vestuario',
      }),
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'chart_of_accounts.duplicate_name',
    })
  })

  it('allows the same name in a different block — the check is scoped to the block', async () => {
    const response = await POST(
      jsonRequest(CATEGORIES_URL, 'POST', {
        blockId: BLOCK_IDS.costOfServices,
        name: 'Vestuário',
      }),
    )

    expect(response.status).toBe(201)
  })

  it('404s a block that does not exist for this user', async () => {
    const response = await POST(
      jsonRequest(CATEGORIES_URL, 'POST', { blockId: 'bloco-inventado', name: 'X' }),
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      code: 'chart_of_accounts.unknown_block',
    })
  })

  it('422s a blank name — a field is required by default (files_design/01 §5.6)', async () => {
    const response = await POST(
      jsonRequest(CATEGORIES_URL, 'POST', { blockId: BLOCK_IDS.personalExpenses, name: '   ' }),
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      code: 'request.invalid',
      errors: [{ field: 'name' }],
    })
  })

  it('422s a name that is not a string, instead of coercing it', async () => {
    const response = await POST(
      jsonRequest(CATEGORIES_URL, 'POST', { blockId: BLOCK_IDS.personalExpenses, name: 42 }),
    )

    expect(response.status).toBe(422)
  })

  it('422s a suggestedClassification outside the closed vocabulary', async () => {
    const response = await POST(
      jsonRequest(CATEGORIES_URL, 'POST', {
        blockId: BLOCK_IDS.personalExpenses,
        name: 'Y',
        suggestedClassification: 'Circulante',
      }),
    )

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      errors: [{ field: 'suggestedClassification' }],
    })
  })

  it('400s a body that is not JSON at all — malformed, not invalid', async () => {
    const response = await POST(
      new Request(CATEGORIES_URL, {
        method: 'POST',
        body: '{oops',
        headers: { 'content-type': 'application/json' },
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'request.malformed' })
  })

  it('never leaks a stack, a SQL string or a file path in the error body (ADR-0009 §3)', async () => {
    const response = await POST(
      jsonRequest(CATEGORIES_URL, 'POST', { blockId: 'bloco-inventado', name: 'X' }),
    )

    expect(response.headers.get('content-type')).toBe('application/problem+json')
    const raw = JSON.stringify(await response.json())
    expect(raw).not.toMatch(/SQLITE|select |insert into|\/Users\/|node_modules|at Object\./i)
  })
})

describe('GET /api/v1/categories', () => {
  it('answers the list envelope the OpenAPI document declares', async () => {
    const response = await GET(new Request(CATEGORIES_URL))

    expect(response.status).toBe(200)
    const parsed = listEnvelope(categorySchema).parse(await response.json())
    expect(parsed.meta.total).toBe(DEFAULT_CATEGORIES.length)
  })

  it('hides archived categories by default and shows them on request', async () => {
    const academia = DEFAULT_CATEGORIES.find((c) => c.name === 'Academia')!
    await handle.repositories.categoryWriter.replace(TEST_USER_ID, { ...academia, archived: true })

    const hidden = (await (await GET(new Request(CATEGORIES_URL))).json()) as {
      data: { id: string }[]
    }
    expect(hidden.data.some((c) => c.id === academia.id)).toBe(false)

    const shown = (await (
      await GET(new Request(`${CATEGORIES_URL}?includeArchived=true`))
    ).json()) as { data: { id: string }[] }
    expect(shown.data.some((c) => c.id === academia.id)).toBe(true)
  })

  it('scopes to one block, archived rows still hidden', async () => {
    const vestuario = DEFAULT_CATEGORIES.find((c) => c.name === 'Vestuário')!
    await handle.repositories.categoryWriter.replace(TEST_USER_ID, { ...vestuario, archived: true })

    const response = await GET(
      new Request(`${CATEGORIES_URL}?blockId=${BLOCK_IDS.personalExpenses}`),
    )
    const body = (await response.json()) as { data: { id: string; blockId: string }[] }

    expect(body.data.every((c) => c.blockId === BLOCK_IDS.personalExpenses)).toBe(true)
    expect(body.data.some((c) => c.id === vestuario.id)).toBe(false)
    expect(body.data.some((c) => c.id === DISCRETIONARY_CATEGORY_ID)).toBe(true)
  })

  it('preserves the reference order of the PRD inside a block, not alphabetical', async () => {
    const response = await GET(
      new Request(`${CATEGORIES_URL}?blockId=${BLOCK_IDS.personalExpenses}&includeArchived=true`),
    )
    const body = (await response.json()) as { data: { id: string }[] }

    expect(body.data.map((c) => c.id)).toEqual(
      DEFAULT_CATEGORIES.filter((c) => c.blockId === BLOCK_IDS.personalExpenses).map((c) => c.id),
    )
  })

  it('422s an unknown query parameter and a value outside the enum', async () => {
    expect((await GET(new Request(`${CATEGORIES_URL}?bogus=1`))).status).toBe(422)
    expect((await GET(new Request(`${CATEGORIES_URL}?includeArchived=sim`))).status).toBe(422)
  })
})
