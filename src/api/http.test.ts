/**
 * The HTTP conventions, tested where they can actually be wrong: the shape of a
 * problem document, the `Location` of a 201, the list envelope, and the table
 * that turns a domain error code into a status.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  API_BASE_PATH,
  DOMAIN_ERROR_STATUS,
  PROBLEM_CONTENT_TYPE,
  created,
  list,
  problem,
  resourcePath,
} from './http'

describe('RFC 9457 — every error is a problem+json document', () => {
  it('carries type, title, status, detail, instance and a machine-readable code', async () => {
    const response = problem(422, 'entries.negative_paid_amount', 'Valor inválido.', '/api/v1/x')

    expect(response.status).toBe(422)
    expect(response.headers.get('content-type')).toBe(PROBLEM_CONTENT_TYPE)
    await expect(response.json()).resolves.toEqual({
      type: 'urn:bigorna:problem:entries.negative_paid_amount',
      title: 'Requisição inválida',
      status: 422,
      detail: 'Valor inválido.',
      instance: '/api/v1/x',
      code: 'entries.negative_paid_amount',
    })
  })

  it('ADR-0009 — the `type` is a URN, so no client is invited to fetch it', async () => {
    const body = (await problem(404, 'resource.not_found', 'x', '/y').json()) as {
      type: string
    }
    expect(body.type.startsWith('urn:')).toBe(true)
    expect(body.type).not.toMatch(/^https?:/)
  })

  it('includes the field errors only when there are any', async () => {
    const withErrors = (await problem(422, 'request.invalid', 'x', '/y', [
      { field: 'amount', code: 'invalid_type' },
    ]).json()) as Record<string, unknown>
    expect(withErrors.errors).toEqual([{ field: 'amount', code: 'invalid_type' }])

    const without = (await problem(404, 'resource.not_found', 'x', '/y').json()) as Record<
      string,
      unknown
    >
    expect('errors' in without).toBe(false)
  })
})

describe('success helpers', () => {
  it('a 201 always carries Location', () => {
    const response = created(resourcePath('entries', 'abc'), { id: 'abc' })
    expect(response.status).toBe(201)
    expect(response.headers.get('location')).toBe('/api/v1/entries/abc')
  })

  it('escapes an id that would otherwise break the Location header', () => {
    expect(resourcePath('entries', 'a b/c')).toBe('/api/v1/entries/a%20b%2Fc')
  })

  it('a collection answers { data, meta: { total } }, with the total before paging', async () => {
    const response = list([{ id: '1' }, { id: '2' }], 57)
    await expect(response.json()).resolves.toEqual({
      data: [{ id: '1' }, { id: '2' }],
      meta: { total: 57 },
    })
  })

  it('the base path is versioned and in English (ADR-0010: the API is infrastructure)', () => {
    expect(API_BASE_PATH).toBe('/api/v1')
  })
})

describe('the domain error table covers what the domain actually throws', () => {
  /**
   * Read from the source, not from memory. A code added to the domain without a
   * line here would answer 500 to a request that is merely invalid, and nothing
   * else in the system would notice.
   */
  function domainErrorCodes(directory: string): string[] {
    const found: string[] = []
    for (const name of readdirSync(directory)) {
      const path = join(directory, name)
      if (statSync(path).isDirectory()) {
        found.push(...domainErrorCodes(path))
        continue
      }
      if (!name.endsWith('.ts') || name.endsWith('.test.ts')) continue
      const source = readFileSync(path, 'utf8')
      for (const match of source.matchAll(/throw new Error\('([a-z_]+\.[a-z_]+)'\)/g)) {
        if (match[1]) found.push(match[1])
      }
    }
    return found
  }

  it('maps every snake_case code thrown in src/domain', () => {
    const codes = new Set(domainErrorCodes(join(process.cwd(), 'src/domain')))
    expect(codes.size).toBeGreaterThan(20)

    const unmapped = [...codes].filter((code) => DOMAIN_ERROR_STATUS[code] === undefined)
    expect(unmapped).toEqual([])
  })

  it('keeps the classification honest: absence is 404, a broken value is 422, state is 409', () => {
    expect(DOMAIN_ERROR_STATUS['chart_of_accounts.unknown_category']).toBe(404)
    expect(DOMAIN_ERROR_STATUS['money.not_an_integer']).toBe(422)
    expect(DOMAIN_ERROR_STATUS['entries.negative_paid_amount']).toBe(422)
    expect(DOMAIN_ERROR_STATUS['chart_of_accounts.duplicate_name']).toBe(409)
    expect(DOMAIN_ERROR_STATUS['recurrence.already_closed']).toBe(409)
    // An inconsistency in the STORED chart of accounts is not the client's fault.
    expect(DOMAIN_ERROR_STATUS['income_statement.missing_block']).toBe(500)
  })
})
