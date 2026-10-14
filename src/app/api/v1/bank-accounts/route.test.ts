/**
 * `GET, POST /api/v1/bank-accounts` — integration tests against the real
 * SQLite adapter (`useTestRepositories`), the way `src/api/README.md`
 * describes: happy path, validation, and the user scope.
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

describe('POST /api/v1/bank-accounts', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  it('creates a bank account and answers 201 with a Location header', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/bank-accounts', 'POST', {
        label: 'Nubank',
        colour: 'nubank',
        entity: 'PF',
        balance: 150000,
      }),
    )

    expect(response.status).toBe(201)
    expect(response.headers.get('location')).toMatch(/^\/api\/v1\/bank-accounts\/.+/)
    const body = (await response.json()) as { id: string; label: string; balance: number }
    expect(body).toMatchObject({
      label: 'Nubank',
      colour: 'nubank',
      entity: 'PF',
      balance: 150000,
    })
    expect(body.id).toBeTruthy()
  })

  it('rejects a negative balance with 422 — the schema is the border (ADR-0009)', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/bank-accounts', 'POST', {
        label: 'Nubank',
        colour: 'nubank',
        balance: 'not-a-number',
      }),
    )
    expect(response.status).toBe(422)
  })

  /**
   * A paleta de "Cor" é uma lista FECHADA de seis: Figma, página **Tokens**, nó
   * `1091:2` "Cores de banco (referência)" — `1091:5055` Nubank · `1091:5061`
   * Itaú · `1091:5067` Banco do Brasil · `1091:5073` Bradesco · `1091:5079`
   * Caixa · `1091:5085` "Cor extra". Antes desta correção o contrato era
   * `z.string().regex(/^[a-z0-9-]{1,40}$/)` sob a alegação de que a lista
   * fechada "does not exist in any source", e este POST respondia **201**: o
   * slug inventado era gravado e a tela pintava a bolinha de cinza pelo
   * fallback de `bankAccountSwatch` — erro de entrada virava dado válido.
   */
  it('rejeita uma cor fora da paleta fechada do Figma Tokens 1091:2 com 422', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/bank-accounts', 'POST', {
        label: 'Nubank',
        colour: 'conta-roxa',
        entity: 'PF',
        balance: 150000,
      }),
    )
    expect(response.status).toBe(422)
  })

  it('rejects an unknown field instead of dropping it silently', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/bank-accounts', 'POST', {
        label: 'Nubank',
        colour: 'nubank',
        balance: 1000,
        rogue: true,
      }),
    )
    expect(response.status).toBe(422)
  })

  it('defaults entity to PF — exception 3 of files_design/03, never absent', async () => {
    const response = await POST(
      jsonRequest('https://x/api/v1/bank-accounts', 'POST', {
        label: 'Conta sem entidade',
        colour: 'itau',
        balance: 500,
      }),
    )
    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ entity: 'PF' })
  })
})

describe('GET /api/v1/bank-accounts', () => {
  let handle: TestRepositories

  beforeEach(() => {
    handle = useTestRepositories()
  })

  afterEach(() => {
    handle.teardown()
  })

  it('lists what was created, and filters by entity', async () => {
    await POST(
      jsonRequest('https://x/api/v1/bank-accounts', 'POST', {
        label: 'Nubank PF',
        colour: 'nubank',
        entity: 'PF',
        balance: 1000,
      }),
    )
    await POST(
      jsonRequest('https://x/api/v1/bank-accounts', 'POST', {
        label: 'Itaú PJ',
        colour: 'banco-do-brasil',
        entity: 'PJ',
        balance: 2000,
      }),
    )

    const all = await GET(new Request('https://x/api/v1/bank-accounts'))
    await expect(all.json()).resolves.toMatchObject({ meta: { total: 2 } })

    const pj = await GET(new Request('https://x/api/v1/bank-accounts?entity=PJ'))
    const body = (await pj.json()) as { data: Array<{ label: string }> }
    expect(body.data).toHaveLength(1)
    expect(body.data[0]?.label).toBe('Itaú PJ')
  })

  it('starts empty for a fresh account — files_design/01 §15 empty state', async () => {
    const response = await GET(new Request('https://x/api/v1/bank-accounts'))
    await expect(response.json()).resolves.toEqual({ data: [], meta: { total: 0 } })
  })
})
