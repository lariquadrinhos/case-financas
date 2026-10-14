/**
 * Wire types for Histórico — inferred from `src/api/contracts/entries.ts`,
 * same convention as `src/features/novo-lancamento/types.ts` and
 * `src/features/plano-de-contas-e-patrimonio/types.ts`.
 */

import type { z } from 'zod'
import type { entrySchema, entryQuerySchema } from '@/api/contracts/entries'
import type { categorySchema } from '@/api/contracts/chart-of-accounts'
import type { bankAccountSchema } from '@/api/contracts/bank-accounts'
import type { Classification, EntryStatus, View } from '@/domain/core'

export type Entry = z.infer<typeof entrySchema>
export type EntryQuery = z.infer<typeof entryQuerySchema>
export type Category = z.infer<typeof categorySchema>
export type BankAccount = z.infer<typeof bankAccountSchema>

/**
 * The seven filters of files_design/03 "Histórico — filtros", as UI state.
 * `''` always means "no filter" — a plain string union (not `EntryQuery`'s own
 * optional fields) so every `<select>` in the toolbar can bind `value` to a
 * plain `string` without an `undefined` branch to guard against.
 */
export interface HistoricoFilters {
  readonly status: EntryStatus | ''
  readonly view: View | ''
  readonly month: string
  readonly categoryId: string
  readonly classification: Classification | ''
  readonly bankAccountId: string
  readonly recurring: '' | 'true' | 'false'
}

export const EMPTY_HISTORICO_FILTERS: HistoricoFilters = {
  status: '',
  view: '',
  month: '',
  categoryId: '',
  classification: '',
  bankAccountId: '',
  recurring: '',
}
