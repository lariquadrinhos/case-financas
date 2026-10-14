/**
 * Consumo Livre — the configuration and the expenses.
 *
 * The configuration is a singleton per person, so it has no id and no list. An
 * expense is the widget's view of a real Lançamento, which is why its id is an
 * `EntryId`: the widget does not invent a second kind of record
 * (src/domain/discretionary-spending/types.ts).
 */

import type {
  DiscretionaryExpense,
  DiscretionarySpendingConfig,
} from '@/domain/discretionary-spending'
import type { EntryId, Month } from '@/domain/core'
import type { UserId } from './common'

export interface DiscretionarySpendingConfigReader {
  /** `null` is the widget's Estado A: never configured (files_design/03). */
  find(userId: UserId): Promise<DiscretionarySpendingConfig | null>
}

export interface DiscretionarySpendingConfigWriter {
  save(userId: UserId, config: DiscretionarySpendingConfig): Promise<DiscretionarySpendingConfig>
}

export interface DiscretionaryExpenseReader {
  findById(userId: UserId, id: EntryId): Promise<DiscretionaryExpense | null>
  /** The widget's history is a month at a time: the allowance refills on the 1st. */
  listByMonth(userId: UserId, month: Month): Promise<readonly DiscretionaryExpense[]>
  /**
   * Todos os gastos, de todos os meses — usado só pela Pendência de sobra
   * (P14), que precisa saber QUAIS meses já fecharam com sobra sem destino.
   * Mesmo motivo pelo qual `profitAllocationReader.listAll` existe e é usado na
   * mesma rota: "quais meses podem ter saldo não alocado" não tem outra
   * resposta hoje.
   */
  listAll(userId: UserId): Promise<readonly DiscretionaryExpense[]>
}

export interface DiscretionaryExpenseWriter {
  /**
   * `description` is the Lançamento's Descrição, which the widget never asks
   * for: only the Open Finance import fills it, with the bank's text
   * (2026-09-29), as it does for every other Lançamento it creates.
   */
  create(
    userId: UserId,
    expense: Omit<DiscretionaryExpense, 'id'> & { readonly description?: string | null },
  ): Promise<DiscretionaryExpense>
  replace(userId: UserId, expense: DiscretionaryExpense): Promise<DiscretionaryExpense>
  remove(userId: UserId, id: EntryId): Promise<void>
  /**
   * Takes the Lançamento out of the widget and KEEPS it — what changing its
   * category away from Consumo Livre means (dono, 2026-10-06). The widget
   * counts every row here, whatever the entry's category, so a re-categorised
   * PIX would otherwise keep eating the month's allowance.
   */
  detach(userId: UserId, id: EntryId): Promise<void>
}
