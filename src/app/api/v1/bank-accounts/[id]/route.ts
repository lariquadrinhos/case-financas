/**
 * `GET, PATCH, DELETE /api/v1/bank-accounts/{id}`.
 *
 * `DELETE` answers 409 (via `bank_accounts.in_use`, mapped in `src/api/http.ts`)
 * when the account is still referenced by a lançamento, uma recorrência ou o
 * Consumo Livre — the foreign keys in `schema.ts` are `RESTRICT`, never
 * `CASCADE` (ADR-0012 §2): a conta bancária used elsewhere must fail loudly,
 * not silently take the history with it.
 */

import type { BankAccount } from '@/domain/assets'
import { asId, cents, type BankAccountId } from '@/domain/core'
import { getRepositories } from '@/data'
import { handler } from '@/api/handler'
import { assertBalanceIsManual } from '@/api/open-finance'
import { NotFoundError, noContent, ok } from '@/api/http'
import { bankAccountPatchSchema } from '@/api/contracts/bank-accounts'
import { idParams } from '@/api/contracts/common'

export const GET = handler({
  operation: 'bank_accounts.read',
  params: idParams,
  handle: async ({ session, params }) => {
    const { bankAccountReader } = getRepositories()
    const account = await bankAccountReader.findById(session.userId, asId<BankAccountId>(params.id))
    if (account === null) {
      throw new NotFoundError('A conta bancária solicitada não existe.')
    }
    return ok(account)
  },
})

export const PATCH = handler({
  operation: 'bank_accounts.update',
  params: idParams,
  body: bankAccountPatchSchema,
  handle: async ({ session, params, body }) => {
    const { bankAccountReader, bankAccountWriter } = getRepositories()
    const accountId = asId<BankAccountId>(params.id)
    const existing = await bankAccountReader.findById(session.userId, accountId)
    if (existing === null) {
      throw new NotFoundError('A conta bancária solicitada não existe.')
    }
    // ADR-0020 §3: numa conta vinculada, o saldo vem do banco a cada sincronização.
    if (body.balance !== undefined && body.balance !== existing.balance) {
      await assertBalanceIsManual(getRepositories(), session.userId, {
        kind: 'BankAccount',
        id: accountId,
      })
    }

    const updated: BankAccount = {
      ...existing,
      ...(body.label !== undefined ? { label: body.label } : {}),
      ...(body.colour !== undefined ? { colour: body.colour } : {}),
      ...(body.entity !== undefined ? { entity: body.entity } : {}),
      ...(body.balance !== undefined ? { balance: cents(body.balance) } : {}),
    }
    const stored = await bankAccountWriter.replace(session.userId, updated)
    return ok(stored)
  },
})

export const DELETE = handler({
  operation: 'bank_accounts.remove',
  params: idParams,
  handle: async ({ session, params }) => {
    const { bankAccountReader, bankAccountWriter } = getRepositories()
    const accountId = asId<BankAccountId>(params.id)
    const existing = await bankAccountReader.findById(session.userId, accountId)
    if (existing === null) {
      throw new NotFoundError('A conta bancária solicitada não existe.')
    }
    await bankAccountWriter.remove(session.userId, accountId)
    return noContent()
  },
})
