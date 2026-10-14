/**
 * Pure rules behind the "Entradas e Saídas" card (files_design/08 §5), kept
 * apart from the component so they are unit-testable without a DOM — same
 * shape as `./discretionary.ts` and `./category-routing.ts`.
 */

import { ZERO, add, isNegative, negate, type Cents } from '@/domain/core'
import type { TreemapItem } from '@/lib/treemap'

/** The cascade effect a Bloco has on the statement (`/statement-blocks`). */
export type BlockEffect = 'Add' | 'Subtract' | 'Signed' | 'None'

export interface StatementRow {
  readonly name: string
  readonly blockId: string
  readonly status: string
  readonly amount: number
}

export interface SplitRow {
  readonly name: string
  readonly amount: Cents
}

/**
 * Splits the statement's `rows` into "entrou" and "saiu".
 *
 * `rows` is the DRE's "Lançamentos deste mês" table and, by contract
 * (`src/api/contracts/reports.ts`), always carries Pago AND Previsto together,
 * deliberately ignoring `statusFilter`. The card's "Sobrou" line, in contrast,
 * is `netProfit`, which DOES respect the filter. Mixing the two printed a
 * Previsto expense in the Saídas column next to "Sobrou R$ 0,00" — exactly the
 * "entradas ≠ saídas" that files_design/08 §5.2 declares impossible by
 * construction. So the split takes `statusFilter` and honours it.
 */
export function splitFlowRows(
  rows: readonly StatementRow[],
  effectOf: ReadonlyMap<string, BlockEffect>,
  statusFilter: string,
): { inflows: SplitRow[]; outflows: SplitRow[] } {
  const inflows: SplitRow[] = []
  const outflows: SplitRow[] = []

  for (const row of rows) {
    if (row.status !== statusFilter) continue
    const effect = effectOf.get(row.blockId)
    const entry: SplitRow = { name: row.name, amount: row.amount as Cents }
    if (effect === 'Add') inflows.push(entry)
    else if (effect === 'Subtract') outflows.push(entry)
    else if (effect === 'Signed') {
      if (isNegative(entry.amount))
        outflows.push({ name: entry.name, amount: negate(entry.amount) })
      else inflows.push(entry)
    }
  }

  return { inflows, outflows }
}

/** Rows sharing a Bloco name collapse into one line, summed. */
export function groupByName(rows: readonly SplitRow[]): TreemapItem[] {
  const totals = new Map<string, Cents>()
  for (const row of rows) {
    totals.set(row.name, add(totals.get(row.name) ?? ZERO, row.amount))
  }
  return [...totals.entries()].map(([name, value]) => ({ id: name, name, value }))
}
