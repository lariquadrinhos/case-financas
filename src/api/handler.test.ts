/**
 * `handler()` is where authorisation and validation stop being something each
 * endpoint remembers to do. These tests are about that guarantee, and about the
 * one thing an error path must never do: leak an internal.
 */

import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { handler } from './handler'
import { NotFoundError, ok } from './http'

const body = z.strictObject({ amount: z.number().int() })

function post(url: string, payload: string): Request {
  return new Request(url, {
    method: 'POST',
    body: payload,
    headers: { 'content-type': 'application/json' },
  })
}

describe('handler — parsing', () => {
  it('passes the session, the parsed query and the parsed body to the route', async () => {
    const route = handler({
      operation: 'test.echo',
      query: z.strictObject({ month: z.string() }),
      body,
      handle: async (input) =>
        ok({
          user: input.session.userId,
          month: input.query.month,
          amount: input.body.amount,
        }),
    })

    const response = await route(post('https://x/api/v1/t?month=2026-07', '{"amount":1500}'))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      user: 'development-user',
      month: '2026-07',
      amount: 1500,
    })
  })

  it('a body that is not JSON is 400 malformed, not 422', async () => {
    const route = handler({ operation: 'test.echo', body, handle: async () => ok({}) })
    const response = await route(post('https://x/api/v1/t', 'not json'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'request.malformed' })
  })

  it('a body that breaks the schema is 422 with one entry per field', async () => {
    const route = handler({ operation: 'test.echo', body, handle: async () => ok({}) })
    const response = await route(post('https://x/api/v1/t', '{"amount":"1500"}'))

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      code: 'request.invalid',
      errors: [{ field: 'amount', code: 'invalid_type' }],
    })
  })

  it('rejects an unknown field instead of dropping it silently', async () => {
    // A silently ignored field is how a client comes to believe it saved
    // something the server never stored.
    const route = handler({ operation: 'test.echo', body, handle: async () => ok({}) })
    const response = await route(post('https://x/api/v1/t', '{"amount":1,"rogue":true}'))

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      errors: [{ field: '(root)', code: 'unrecognized_keys' }],
    })
  })

  it('never calls the route when the input does not parse', async () => {
    let called = false
    const route = handler({
      operation: 'test.echo',
      body,
      handle: async () => {
        called = true
        return ok({})
      },
    })

    await route(post('https://x/api/v1/t', '{"amount":"x"}'))
    expect(called).toBe(false)
  })
})

describe('handler — error mapping', () => {
  it('maps a domain error code to its status and answers with the code', async () => {
    const route = handler({
      operation: 'test.fail',
      handle: async () => {
        throw new Error('entries.negative_paid_amount')
      },
    })

    const response = await route(new Request('https://x/api/v1/entries/1/payment'))
    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      code: 'entries.negative_paid_amount',
      instance: '/api/v1/entries/1/payment',
    })
  })

  it('answers 404 for an absent resource', async () => {
    const route = handler({
      operation: 'test.absent',
      handle: async () => {
        throw new NotFoundError('Esse lançamento não existe.')
      },
    })

    const response = await route(new Request('https://x/api/v1/entries/1'))
    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      code: 'resource.not_found',
      detail: 'Esse lançamento não existe.',
    })
  })

  it('ADR-0009 — an unexpected error leaks no message, no path and no stack', async () => {
    const route = handler({
      operation: 'test.boom',
      handle: async () => {
        throw new Error('SQLITE_ERROR: no such column: /Users/someone/.data/bigorna.db')
      },
    })

    const response = await route(new Request('https://x/api/v1/entries'))
    expect(response.status).toBe(500)

    const text = await response.text()
    expect(text).not.toContain('SQLITE')
    expect(text).not.toContain('.data')
    expect(text).not.toContain('at ')
    expect(JSON.parse(text)).toMatchObject({ code: 'internal.unexpected' })
  })
})

describe('ADR-0009 §3 — the log records that something happened, never what', () => {
  it('never writes an unclassified error message into the log line', async () => {
    // Found by measuring the previous version: `log.error(..., { code: error.message })`
    // emitted `SQLITE_ERROR: no such column: /Users/someone/.data/bigorna.db`.
    const lines: string[] = []
    const original = console.error
    console.error = (line: string) => {
      lines.push(String(line))
    }

    try {
      const route = handler({
        operation: 'test.boom',
        handle: async () => {
          throw new Error('SQLITE_ERROR: no such column: /Users/someone/.data/bigorna.db')
        },
      })
      await route(new Request('https://x/api/v1/entries'))
    } finally {
      console.error = original
    }

    expect(lines).toHaveLength(1)
    expect(lines[0]).not.toContain('/Users/')
    expect(lines[0]).not.toContain('SQLITE')
    expect(JSON.parse(lines[0] as string)).toEqual({
      level: 'error',
      event: 'api.failed',
      operation: 'test.boom',
      code: 'unclassified',
    })
  })
})
