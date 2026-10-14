/**
 * The operator printed before a DRE cascade line — files_design/08 §4
 * ("operador em coluna de largura fixa").
 *
 * The wire (`statementLineSchema`, `src/api/contracts/reports.ts`) does not
 * carry a block's `CascadeEffect` — only `label`/`amount`/`level`/`key` —
 * because that is chart-of-accounts metadata, not report data. The 10 blocks
 * are fixed for now (files_design/01 §3.1: "Blocos são fixos"), so looking the
 * effect up by block id from the SAME `DEFAULT_BLOCKS` the domain computes
 * from is reading the real source, not guessing a parallel one.
 *
 * Pulled out of the DRE page into its own pure module so the mapping is
 * unit-testable without rendering React (mirrors `@/lib/treemap` and
 * `@/lib/monthly-trend-chart`'s split between "the rule" and "the screen").
 */

import { DEFAULT_BLOCKS, LABEL_CASCADE_PREFIX } from '@/domain/chart-of-accounts'

const CASCADE_PREFIX_BY_BLOCK_ID = new Map(
  DEFAULT_BLOCKS.map((block) => [block.id as string, LABEL_CASCADE_PREFIX[block.effect]]),
)

export interface CascadeLineLike {
  readonly kind: 'block' | 'subtotal'
  readonly key: string
}

/** files_design/08 §4: a subtotal line (Lucro Bruto, EBITDA, EBIT, Lucro
 * Líquido) always prints "=" — that is what makes it a RESULT, not a movement. */
export function operatorFor(line: CascadeLineLike): string {
  if (line.kind === 'subtotal') return '='
  return CASCADE_PREFIX_BY_BLOCK_ID.get(line.key) ?? ''
}
