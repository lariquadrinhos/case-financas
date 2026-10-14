/**
 * Client-side fetch helper for `/api/v1/*` — the one place a browser request
 * is built, so every screen sends/reads the same shapes the contracts in
 * `src/api/contracts/*` describe.
 *
 * `connect-src 'self'` (src/middleware.ts) only allows same-origin requests,
 * which is exactly what a relative `/api/v1/...` path is — no base URL to
 * configure, no external host involved.
 */

import { API_BASE_PATH } from '@/api/http'
import type { ProblemDetails } from '@/api/http'

export class ApiError extends Error {
  readonly problem: ProblemDetails | null
  readonly status: number

  constructor(status: number, problem: ProblemDetails | null) {
    super(problem?.detail ?? `Erro ${status} ao chamar a API.`)
    this.status = status
    this.problem = problem
  }
}

type QueryValue = string | number | boolean | undefined | null

function toSearchParams(query?: Record<string, QueryValue>): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

async function request<T>(
  method: string,
  path: string,
  options?: { query?: Record<string, QueryValue>; body?: unknown },
): Promise<T> {
  const response = await fetch(`${API_BASE_PATH}${path}${toSearchParams(options?.query)}`, {
    method,
    headers: options?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (response.status === 204) return undefined as T

  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('json') ? await response.json() : null

  if (!response.ok) {
    throw new ApiError(response.status, payload as ProblemDetails | null)
  }
  return payload as T
}

export const apiGet = <T>(path: string, query?: Record<string, QueryValue>) =>
  request<T>('GET', path, { query })

export const apiPost = <T>(path: string, body?: unknown) => request<T>('POST', path, { body })

export const apiPut = <T>(path: string, body?: unknown) => request<T>('PUT', path, { body })

export const apiPatch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body })

export const apiDelete = (path: string) => request<void>('DELETE', path)
