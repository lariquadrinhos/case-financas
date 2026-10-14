/**
 * Shared seed for Lançamentos/Recorrência route-handler integration tests: the
 * reference Plano de Contas and one bank account per entity, built through the
 * SAME repositories the routes use (`getRepositories()`) — never a raw SQL
 * insert — so a route test seeds data exactly the way the product produces it.
 *
 * Lives in `src/data/fixtures/` (not beside the route tests) for the same
 * reason `test-repositories.ts` does: `eslint.config.mjs` forbids
 * `src/app/**` from importing `@/data/sqlite`, and a route test must reach the
 * real chart-of-accounts/bank-accounts adapters to have anything to point a
 * Lançamento at.
 */

import { DEFAULT_BLOCKS, DEFAULT_CATEGORIES } from '@/domain/chart-of-accounts'
import { ZERO, asId, type BankAccountId, type CategoryId } from '@/domain/core'
import { getRepositories } from '@/data'
import type { UserId } from '@/data/contracts/common'

export interface EntriesTestFixture {
  readonly pfAccountId: BankAccountId
  readonly pjAccountId: BankAccountId
  /** "Aluguel moradia", Despesas Administrativas — an ordinary expense category. */
  readonly expenseCategoryId: CategoryId
}

export async function seedEntriesFixture(userId: UserId): Promise<EntriesTestFixture> {
  const { statementBlockWriter, categoryWriter, bankAccountWriter } = getRepositories()
  await statementBlockWriter.seed(userId, DEFAULT_BLOCKS)
  await categoryWriter.seed(userId, DEFAULT_CATEGORIES)

  const pfAccount = await bankAccountWriter.create(userId, {
    label: 'Conta PF',
    colour: 'banco-do-brasil',
    entity: 'PF',
    balance: ZERO,
  })
  const pjAccount = await bankAccountWriter.create(userId, {
    label: 'Conta PJ',
    colour: 'itau',
    entity: 'PJ',
    balance: ZERO,
  })

  return {
    pfAccountId: pfAccount.id,
    pjAccountId: pjAccount.id,
    expenseCategoryId: asId<CategoryId>('aluguel-moradia'),
  }
}
