/**
 * `handler()` — the wrapper every route in `src/app/api/**` is built with.
 *
 * It is not a style preference: `requireSession()` (ADR-0008 §2) and the Zod
 * parse of every input (ADR-0009) live INSIDE the wrapper, so they cannot be
 * forgotten one endpoint at a time. A route handler that does not use it is a
 * defect, not a shortcut.
 *
 * What a handler built with it still has to do, and nothing more: delegate to a
 * repository port or a domain function, and serialise the result.
 */

import { log } from '@/lib/log'
import { requireSession, type Session } from '@/server/session'
import type { ZodType } from 'zod'
import { ZodError } from 'zod'
import {
  DOMAIN_ERROR_DETAIL,
  DOMAIN_ERROR_STATUS,
  NOT_FOUND_CODE,
  NotFoundError,
  STATUS,
  problem,
} from './http'
import type { ProblemFieldError } from './http'

/* -------------------------------------------------------------------------
 * The wrapper
 * ---------------------------------------------------------------------- */

/**
 * Next 15 hands every route a context object; for a dynamic segment `params`
 * always resolves (a static route's handler never declares this parameter at
 * all — see the two `handler()` overloads below). `params` is therefore
 * required, not optional: Next's generated per-route validator
 * (`.next/types/app/**\/route.ts`) checks it against exactly
 * `{ params: Promise<...> }`, and an optional key there is a type mismatch
 * `next build` refuses to compile (measured — see the comment on `handler()`).
 */
export interface RouteContext {
  readonly params: Promise<Record<string, string | string[] | undefined>>
}

export interface HandlerInput<P, Q, B> {
  readonly session: Session
  readonly params: P
  readonly query: Q
  readonly body: B
  readonly request: Request
}

export interface HandlerConfig<P, Q, B> {
  /**
   * Opaque event name used for logging, e.g. `entries.create`. It is the ONLY
   * thing this module logs besides a status: never a field, never a value
   * (ADR-0009 §3).
   */
  readonly operation: string
  readonly params?: ZodType<P>
  readonly query?: ZodType<Q>
  readonly body?: ZodType<B>
  readonly handle: (input: HandlerInput<P, Q, B>) => Promise<Response>
}

function fieldErrors(error: ZodError): readonly ProblemFieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    code: issue.code,
  }))
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : ''
}

/**
 * The closed shape of a domain error code: `namespace.reason`, snake_case, no
 * user data and no path in it.
 *
 * Measured, not assumed: before this guard the 500 branch logged
 * `error.message`, and a thrown `SQLITE_ERROR: no such column:
 * /Users/someone/.data/bigorna.db` went straight into the log line. ADR-0009 §3
 * says the log records THAT something happened, never WHAT — a filesystem path
 * is exactly the kind of internal that must not travel to a terminal, a CI job
 * or a third-party collector.
 */
const DOMAIN_CODE_PATTERN = /^[a-z][a-z_]*\.[a-z][a-z_]*$/

function safeCode(message: string): string {
  return DOMAIN_CODE_PATTERN.test(message) ? message : 'unclassified'
}

/**
 * Wraps a route handler with the four things every endpoint must do, in order:
 * authorise, parse, delegate, map errors.
 *
 * Ordering is deliberate: the session is checked BEFORE the body is parsed, so
 * an unauthenticated caller cannot use validation messages to probe the shape
 * of the API.
 *
 * Two overloads, not one, and it is not a style choice: `next build` generates
 * a validator per route (`.next/types/app/**\/route.ts`) that reads the SECOND
 * declared parameter's type straight off the exported `GET`/`POST`/etc and
 * requires it to be exactly `{ params: Promise<...> }` — never a union with
 * `undefined`. A single signature typed `context?: RouteContext` (the shape
 * every route without a dynamic segment needs, so its test can call
 * `GET(request)` with one argument) made EVERY route in the app fail that
 * check, `bank-accounts/[id]` merely being the first one alphabetically:
 * measured by running `npm run build` after `npx playwright install` for the
 * e2e suite, which needs a production server and therefore a build that
 * actually completes. A route with no `params` schema now returns a
 * one-argument function (arity matches every existing static-route test); a
 * route WITH one returns a two-argument function whose second parameter is
 * required, matching what Next always supplies for a dynamic segment.
 */
export function handler<Q = undefined, B = undefined>(
  config: HandlerConfig<undefined, Q, B> & { params?: undefined },
): (request: Request) => Promise<Response>
export function handler<P, Q = undefined, B = undefined>(
  config: HandlerConfig<P, Q, B> & { params: ZodType<P> },
): (request: Request, context: RouteContext) => Promise<Response>
export function handler<P = undefined, Q = undefined, B = undefined>(
  config: HandlerConfig<P, Q, B>,
): (request: Request, context?: RouteContext) => Promise<Response> {
  return async function route(request: Request, context?: RouteContext): Promise<Response> {
    const instance = new URL(request.url).pathname

    let session: Session
    try {
      session = await requireSession()
    } catch {
      return problem(
        STATUS.unauthorized,
        'session.missing',
        'Não há sessão para esta requisição.',
        instance,
      )
    }

    let params: P
    let query: Q
    let body: B
    try {
      const rawParams = context?.params ? await context.params : {}
      params = (config.params ? config.params.parse(rawParams) : undefined) as P

      const rawQuery = Object.fromEntries(new URL(request.url).searchParams)
      query = (config.query ? config.query.parse(rawQuery) : undefined) as Q

      if (config.body) {
        let raw: unknown
        try {
          raw = await request.json()
        } catch {
          // Not JSON at all: the request never reached the schema, so it is
          // malformed (400), not semantically invalid (422).
          return problem(
            STATUS.badRequest,
            'request.malformed',
            'O corpo da requisição não é JSON válido.',
            instance,
          )
        }
        body = config.body.parse(raw)
      } else {
        body = undefined as B
      }
    } catch (error) {
      if (error instanceof ZodError) {
        return problem(
          STATUS.unprocessable,
          'request.invalid',
          'A requisição não passou na validação.',
          instance,
          fieldErrors(error),
        )
      }
      throw error
    }

    try {
      return await config.handle({ session, params, query, body, request })
    } catch (error) {
      const code = messageOf(error)

      if (code === NOT_FOUND_CODE) {
        const detail = error instanceof NotFoundError ? error.detail : 'O recurso não existe.'
        return problem(STATUS.notFound, NOT_FOUND_CODE, detail, instance)
      }

      const status = DOMAIN_ERROR_STATUS[code]
      if (status !== undefined && status !== STATUS.internal) {
        // The code IS the message: it is a closed, snake_case vocabulary with no
        // user data in it, which is why it is safe to send back and to log.
        log.warn('api.rejected', { operation: config.operation, code, status })
        const detail = DOMAIN_ERROR_DETAIL[code] ?? 'A operação não pôde ser concluída.'
        return problem(status, code, detail, instance)
      }

      log.error('api.failed', { operation: config.operation, code: safeCode(code) })
      return problem(
        STATUS.internal,
        'internal.unexpected',
        'Erro inesperado ao processar a requisição.',
        instance,
      )
    }
  }
}
