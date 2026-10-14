/**
 * The Pluggy adapter against a fake `fetch` — no network, synthetic payloads
 * (ADR-0020 §7).
 */

import { describe, expect, it } from 'vitest'

import { isoDate } from '@/domain/core'
import type { ProviderAccountId } from '@/domain/open-finance'
import type { UserId } from '@/data/contracts/common'
import { createOpenFinanceReaderFromEnv, createPluggyReader } from './index'

const USER = 'development-user' as UserId

interface Call {
  readonly url: string
  readonly init: RequestInit | undefined
}

/** Answers by exact path + query; anything else is a 404, so a wrong URL fails the test. */
function fakeFetch(routes: Record<string, unknown>, calls: Call[] = []) {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    const body = routes[url.replace('https://api.pluggy.ai', '')]
    if (body === undefined) return new Response('{}', { status: 404 })
    if (body instanceof Response) return body
    return new Response(JSON.stringify(body), { status: 200 })
  }
}

const AUTH = { '/auth': { apiKey: 'chave-sintetica' } }

describe('createPluggyReader', () => {
  it('troca clientId/secret por API Key uma vez e reaproveita nas chamadas seguintes', async () => {
    const calls: Call[] = []
    const reader = createPluggyReader({
      clientId: 'id',
      clientSecret: 'segredo',
      itemIds: ['item-1'],
      fetch: fakeFetch(
        {
          ...AUTH,
          '/accounts?itemId=item-1': { results: [] },
          '/investments?itemId=item-1&pageSize=500': { results: [] },
        },
        calls,
      ),
    })
    await reader.listAccounts(USER)
    await reader.listAccounts(USER)

    expect(calls.filter((c) => c.url.endsWith('/auth'))).toHaveLength(1)
    const autenticada = calls.find((c) => c.url.includes('/accounts'))
    expect(new Headers(autenticada?.init?.headers).get('X-API-KEY')).toBe('chave-sintetica')
  })

  it('o banco de cada conta vem do connector.name da conexão; se falhar, fica null e a conta continua', async () => {
    const reader = createPluggyReader({
      clientId: 'id',
      clientSecret: 'segredo',
      itemIds: ['item-1', 'item-2'],
      fetch: fakeFetch({
        ...AUTH,
        '/items/item-1': { connector: { name: 'Banco Sintético' } },
        '/accounts?itemId=item-1': {
          results: [{ id: 'a1', type: 'BANK', name: 'Conta', balance: 0 }],
        },
        '/accounts?itemId=item-2': {
          results: [{ id: 'a2', type: 'BANK', name: 'Conta', balance: 0 }],
        },
        '/investments?itemId=item-1&pageSize=500': { results: [] },
        '/investments?itemId=item-2&pageSize=500': { results: [] },
      }),
    })
    const accounts = await reader.listAccounts(USER)
    expect(accounts.map((a) => [a.id, a.institution])).toEqual([
      ['a1', 'Banco Sintético'],
      ['a2', null],
    ])
  })

  it('lê as contas e os investimentos de todas as conexões do .env', async () => {
    const reader = createPluggyReader({
      clientId: 'id',
      clientSecret: 'segredo',
      itemIds: ['item-1', 'item-2'],
      fetch: fakeFetch({
        ...AUTH,
        '/accounts?itemId=item-1': {
          results: [{ id: 'a1', type: 'BANK', name: 'Conta', balance: 10, number: '1' }],
        },
        '/accounts?itemId=item-2': {
          results: [{ id: 'a2', type: 'CREDIT', name: 'Cartão', balance: 2, number: '2' }],
        },
        '/investments?itemId=item-1&pageSize=500': { results: [] },
        '/investments?itemId=item-2&pageSize=500': {
          results: [{ id: 'i1', name: 'CDB', balance: 100 }],
        },
      }),
    })
    const accounts = await reader.listAccounts(USER)
    expect(accounts.map((a) => [a.id, a.kind])).toEqual([
      ['a1', 'Checking'],
      ['a2', 'CreditCard'],
      ['i1', 'Investment'],
    ])
  })

  it('lê /v2/transactions seguindo o cursor `next` e descarta as PENDING da conta corrente', async () => {
    // Medido em 2026-09-29: o GET /transactions paginado por número responde
    // 410 ENDPOINT_DEPRECATED ("Use GET /v2/transactions with cursor pagination").
    const tx = (id: string, status = 'POSTED') => ({
      id,
      description: 'x',
      amount: -1,
      date: '2026-09-10T00:00:00.000Z',
      status,
      currencyCode: 'BRL',
    })
    const reader = createPluggyReader({
      clientId: 'id',
      clientSecret: 'segredo',
      itemIds: ['item-1'],
      fetch: fakeFetch({
        ...AUTH,
        '/accounts?itemId=item-1': {
          results: [{ id: 'a1', type: 'BANK', name: 'Conta', balance: 0 }],
        },
        '/investments?itemId=item-1&pageSize=500': { results: [] },
        '/v2/transactions?accountId=a1&dateFrom=2026-09-01': {
          results: [tx('t1'), tx('t2', 'PENDING')],
          next: '?accountId=a1&after=cursor-sintetico',
        },
        '/v2/transactions?accountId=a1&after=cursor-sintetico': {
          results: [tx('t3')],
          next: null,
        },
      }),
    })
    await reader.listAccounts(USER)
    const transactions = await reader.listTransactions(
      USER,
      'a1' as ProviderAccountId,
      isoDate('2026-09-01'),
    )
    expect(transactions.map((t) => t.id)).toEqual(['t1', 't3'])
  })

  it('ADR-0009 — falha do provedor vira erro com código, sem o corpo da resposta', async () => {
    const reader = createPluggyReader({
      clientId: 'id',
      clientSecret: 'segredo',
      itemIds: ['item-1'],
      fetch: fakeFetch({
        '/auth': new Response('{"message":"credencial sintética inválida"}', { status: 401 }),
      }),
    })
    await expect(reader.listAccounts(USER)).rejects.toThrow('open_finance.provider_unavailable')
  })
})

describe('createOpenFinanceReaderFromEnv', () => {
  it('ADR-0020 §2 — sem credenciais no ambiente, recusa com open_finance.not_configured', async () => {
    const reader = createOpenFinanceReaderFromEnv({})
    await expect(reader.listAccounts(USER)).rejects.toThrow('open_finance.not_configured')
  })
})
