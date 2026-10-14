/**
 * The human-readable "subject" a `TraceEvent` description needs
 * (`@/domain/trace-events` `describeDiscrepancy`/`describeRecurrencePaid`,
 * both take a `subject: string`) — shared by `POST /entries/{id}/payment` and
 * `POST /occurrences/{id}/payment`, the two routes that emit one on a
 * divergence.
 *
 * This is deliberately NOT a domain function: resolving it means reading a
 * Category, which is I/O, and `src/domain/trace-events` depends only on
 * `core` (src/domain/README.md "A regra de dependência") — the description
 * itself stays a pure function of primitives, this is the composition that
 * gets it one.
 */

import type { CategoryReader } from '@/data/contracts/chart-of-accounts'
import type { UserId } from '@/data/contracts/common'
import type { CategorizedEntry, Entry } from '@/domain/entries'
import { isCategorized } from '@/domain/entries'

function isCategorizedEntry(entry: Entry): entry is CategorizedEntry {
  return isCategorized(entry)
}

/**
 * Expense/Revenue: the category name is the closest thing to a name this
 * Lançamento has (files_design/03 — Despesa/Receita têm Categoria, não
 * Rótulo). ProLabore/ProfitDistribution have neither Categoria nor Rótulo, so
 * a fixed pt-BR name stands in. IncomeTax keeps its own Rótulo when the person
 * typed one.
 */
export async function entrySubject(
  entry: Entry,
  categoryReader: CategoryReader,
  userId: UserId,
): Promise<string> {
  if (isCategorizedEntry(entry)) {
    const category = await categoryReader.findById(userId, entry.categoryId)
    return category?.name ?? 'Lançamento'
  }
  switch (entry.kind) {
    case 'ProLabore':
      return 'Pró-labore'
    case 'ProfitDistribution':
      return 'Distribuição de lucro'
    case 'IncomeTax':
      return entry.label ?? 'Imposto de Renda'
  }
}
