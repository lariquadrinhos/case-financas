/**
 * `PATCH /api/v1/categories/{id}` — "Editar" on a category line (Figma 46:33).
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
import { PATCH } from './route'

function patchRequest(id: string, body: unknown): Request {
  return new Request(`https://x/api/v1/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

const ALIMENTACAO = DEFAULT_CATEGORIES.find((c) => c.name === 'Alimentação')!

let handle: TestRepositories

beforeEach(async () => {
  handle = useTestRepositories()
  await handle.repositories.statementBlockWriter.seed(TEST_USER_ID, DEFAULT_BLOCKS)
  await handle.repositories.categoryWriter.seed(TEST_USER_ID, DEFAULT_CATEGORIES)
})

afterEach(() => {
  handle.teardown()
})

describe('PATCH /api/v1/categories/{id}', () => {
  it('renames a category and persists it', async () => {
    const response = await PATCH(
      patchRequest(ALIMENTACAO.id, { name: 'Alimentação e mercado' }),
      ctx(ALIMENTACAO.id),
    )

    expect(response.status).toBe(200)
    expect(categorySchema.parse(await response.json())).toMatchObject({
      id: ALIMENTACAO.id,
      name: 'Alimentação e mercado',
      blockId: ALIMENTACAO.blockId,
    })
    await expect(
      handle.repositories.categoryReader.findById(TEST_USER_ID, ALIMENTACAO.id),
    ).resolves.toMatchObject({ name: 'Alimentação e mercado' })
  })

  it('fixing only the accents of a name goes through — the namesake is the category itself', async () => {
    const vestuario = DEFAULT_CATEGORIES.find((c) => c.name === 'Vestuário')!
    const response = await PATCH(
      patchRequest(vestuario.id, { name: 'vestuario' }),
      ctx(vestuario.id),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ name: 'vestuario' })
  })

  it('updates suggestedClassification without touching the name', async () => {
    const response = await PATCH(
      patchRequest(ALIMENTACAO.id, { suggestedClassification: 'Current' }),
      ctx(ALIMENTACAO.id),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      name: 'Alimentação',
      suggestedClassification: 'Current',
    })
  })

  it('409s a name already taken by another category of the same block', async () => {
    const response = await PATCH(
      patchRequest(ALIMENTACAO.id, { name: 'Transporte' }),
      ctx(ALIMENTACAO.id),
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'chart_of_accounts.duplicate_name',
    })
    // The stored name is untouched by the refused attempt.
    await expect(
      handle.repositories.categoryReader.findById(TEST_USER_ID, ALIMENTACAO.id),
    ).resolves.toMatchObject({ name: 'Alimentação' })
  })

  it('409s the system category — the Consumo Livre widget has no other target (P10)', async () => {
    const response = await PATCH(
      patchRequest(DISCRETIONARY_CATEGORY_ID, { name: 'Outro nome' }),
      ctx(DISCRETIONARY_CATEGORY_ID),
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'chart_of_accounts.system_category_is_fixed',
    })
  })

  it('404s an id that is not this user’s, without saying whether it exists (ADR-0008 §3)', async () => {
    const response = await PATCH(patchRequest('nao-existe', { name: 'A' }), ctx('nao-existe'))

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body).toMatchObject({ code: 'resource.not_found' })
    expect(JSON.stringify(body)).not.toMatch(/SQLITE|select |\/Users\/|at Object\./i)
  })

  it('422s a blank name and an unknown field', async () => {
    expect(
      (await PATCH(patchRequest(ALIMENTACAO.id, { name: '  ' }), ctx(ALIMENTACAO.id))).status,
    ).toBe(422)
    expect(
      (await PATCH(patchRequest(ALIMENTACAO.id, { blockId: 'outro' }), ctx(ALIMENTACAO.id))).status,
    ).toBe(422)
  })

  it('a category never moves block — blockId is not patchable', async () => {
    await PATCH(patchRequest(ALIMENTACAO.id, { name: 'Mercado' }), ctx(ALIMENTACAO.id))

    await expect(
      handle.repositories.categoryReader.findById(TEST_USER_ID, ALIMENTACAO.id),
    ).resolves.toMatchObject({ blockId: ALIMENTACAO.blockId })
  })
})
