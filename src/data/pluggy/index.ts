/**
 * The Pluggy adapter for `OpenFinanceReader` (ADR-0020 §1–§2).
 *
 * Server only, read only. It holds the application credentials
 * (`PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`), trades them for an API Key
 * (`POST /auth`, valid for 2 hours) and reads the connections listed in
 * `PLUGGY_ITEM_IDS` — Pluggy has no endpoint that lists an application's
 * connections ("For security reasons, Pluggy does not provide a method to list
 * all existing connections", docs.pluggy.ai, "Item"), so the ids come from the
 * Meu Pluggy dashboard into the `.env`.
 *
 * `POST /items` is never called: it is the path where a bank password would
 * go through this server (ADR-0020 §1).
 *
 * Plain `fetch`, no SDK: one fewer dependency to audit (`make audit-deps`) for
 * five GET endpoints.
 */

import type { IsoDate } from '@/domain/core'
import type {
  ImportedTransaction,
  OpenFinanceAccount,
  OpenFinanceAccountKind,
  ProviderAccountId,
} from '@/domain/open-finance'
import type { UserId } from '@/data/contracts/common'
import type { OpenFinanceReader } from '@/data/contracts/open-finance'
import {
  normalizeAccount,
  normalizeInvestment,
  normalizeBill,
  normalizeTransaction,
  type PluggyAccount,
  type PluggyBill,
  type PluggyInvestment,
  type PluggyTransaction,
} from './normalize'

const BASE_URL = 'https://api.pluggy.ai'
/** The key lasts 2 hours; renewing at 100 minutes leaves room for a slow sync. */
const API_KEY_TTL_MS = 100 * 60 * 1000
const TIMEOUT_MS = 15_000
const PAGE_SIZE = 500

export interface PluggyReaderOptions {
  readonly clientId: string
  readonly clientSecret: string
  readonly itemIds: readonly string[]
  readonly fetch?: typeof fetch
  readonly now?: () => number
}

interface Paged<T> {
  readonly results: readonly T[]
}

interface Cursor<T> {
  readonly results: readonly T[]
  readonly next?: string | null
}

export function createPluggyReader(options: PluggyReaderOptions): OpenFinanceReader {
  const doFetch = options.fetch ?? fetch
  const now = options.now ?? Date.now
  let apiKey: { value: string; expiresAt: number } | null = null
  /** The sign of a transaction depends on the account kind (normalize.ts). */
  const kindOf = new Map<string, OpenFinanceAccountKind>()

  async function authenticate(): Promise<string> {
    if (apiKey !== null && apiKey.expiresAt > now()) return apiKey.value
    const response = await doFetch(`${BASE_URL}/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId: options.clientId, clientSecret: options.clientSecret }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    // The body is never read into the error: it may echo the request, and an
    // error message ends up in logs and tickets (ADR-0009 §3).
    if (!response.ok) throw new Error('open_finance.provider_unavailable')
    const body = (await response.json()) as { apiKey?: string }
    if (typeof body.apiKey !== 'string') throw new Error('open_finance.provider_unavailable')
    apiKey = { value: body.apiKey, expiresAt: now() + API_KEY_TTL_MS }
    return apiKey.value
  }

  async function get<T>(path: string, retried = false): Promise<T> {
    const response = await doFetch(`${BASE_URL}${path}`, {
      headers: { 'X-API-KEY': await authenticate() },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (response.status === 401 && !retried) {
      // A key revoked before its time: renew once, then give up.
      apiKey = null
      return get<T>(path, true)
    }
    if (!response.ok) throw new Error('open_finance.provider_unavailable')
    return (await response.json()) as T
  }

  /**
   * The bank of each connection, for grouping on screen. `GET /items/{id}`
   * answers `connector.name` — measured on 2026-09-29 against the five real
   * connections: 200, a string on every one. A failure here only loses the
   * grouping, never the accounts.
   */
  async function institutionOf(itemId: string): Promise<string | null> {
    try {
      const item = await get<{ connector?: { name?: unknown } }>(
        `/items/${encodeURIComponent(itemId)}`,
      )
      return typeof item.connector?.name === 'string' ? item.connector.name : null
    } catch {
      return null
    }
  }

  async function listAccounts(): Promise<readonly OpenFinanceAccount[]> {
    const accounts: OpenFinanceAccount[] = []
    const investments: OpenFinanceAccount[] = []
    for (const itemId of options.itemIds) {
      const item = encodeURIComponent(itemId)
      const institution = await institutionOf(itemId)
      const bank = await get<Paged<PluggyAccount>>(`/accounts?itemId=${item}`)
      accounts.push(...bank.results.map((a) => normalizeAccount(a, institution)))
      const held = await get<Paged<PluggyInvestment>>(
        `/investments?itemId=${item}&pageSize=${PAGE_SIZE}`,
      )
      investments.push(...held.results.map((i) => normalizeInvestment(i, institution)))
    }
    const all = [...accounts, ...investments]
    for (const account of all) kindOf.set(account.id, account.kind)
    return all
  }

  return {
    async listAccounts(_userId: UserId) {
      return listAccounts()
    },

    async listTransactions(_userId: UserId, accountId: ProviderAccountId, from: IsoDate) {
      if (!kindOf.has(accountId)) await listAccounts()
      const kind = kindOf.get(accountId)
      if (kind === undefined) throw new Error('open_finance.unknown_provider_account')

      // `GET /v2/transactions`, cursor-paginated. Measured on 2026-09-29: the
      // page-numbered `GET /transactions` answers 410 ENDPOINT_DEPRECATED ("Use
      // GET /v2/transactions with cursor pagination instead"), which failed
      // every sync — and, because the bank is read before anything is written,
      // took the balances down with it. `next` is a query string
      // ("?accountId=…&after=…") until the last page, where it is null.
      const transactions: ImportedTransaction[] = []
      let path: string | null =
        `/v2/transactions?accountId=${encodeURIComponent(accountId)}&dateFrom=${from}`
      while (path !== null) {
        const body: Cursor<PluggyTransaction> = await get<Cursor<PluggyTransaction>>(path)
        for (const raw of body.results) {
          const normalized = normalizeTransaction(raw, { id: accountId, kind })
          if (normalized !== null) transactions.push(normalized)
        }
        const next = typeof body.next === 'string' && body.next.length > 0 ? body.next : null
        path = next === null ? null : `/v2/transactions${next.slice(next.indexOf('?'))}`
      }
      return transactions
    },

    async listBills(_userId: UserId, accountId: ProviderAccountId) {
      // Measured on 2026-09-29: `GET /bills?accountId=` answers 200 with
      // `id`, `dueDate`, `billClosingDate` and `totalAmount` for both cards.
      const body = await get<Paged<PluggyBill>>(`/bills?accountId=${encodeURIComponent(accountId)}`)
      return body.results.map((bill) => normalizeBill(bill, accountId))
    },
  }
}

const notConfigured: OpenFinanceReader = {
  async listBills() {
    throw new Error('open_finance.not_configured')
  },
  async listAccounts() {
    throw new Error('open_finance.not_configured')
  },
  async listTransactions() {
    throw new Error('open_finance.not_configured')
  },
}

/**
 * Chooses the adapter from the environment. Without credentials the app keeps
 * working as before and the Open Finance endpoints answer 409
 * `open_finance.not_configured`.
 */
export function createOpenFinanceReaderFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): OpenFinanceReader {
  const clientId = env.PLUGGY_CLIENT_ID?.trim()
  const clientSecret = env.PLUGGY_CLIENT_SECRET?.trim()
  const itemIds = (env.PLUGGY_ITEM_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
  if (!clientId || !clientSecret || itemIds.length === 0) return notConfigured
  return createPluggyReader({ clientId, clientSecret, itemIds })
}
