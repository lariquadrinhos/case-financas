'use client'

import type { EntryStatus } from '@/domain/core'
import { SegmentedControl } from '@/components/patterns/segmented-control'

const STATUS_OPTIONS: readonly { value: EntryStatus; label: string }[] = [
  { value: 'Paid', label: 'Pago' },
  { value: 'Planned', label: 'Previsto' },
]

/**
 * "Pago / Previsto" — files_design/01 §8.1 and §8.4 (Figma 239:12-16,
 * 11:2). The generic pair, not `LABEL_STATUS` (`@/domain/core`), which is
 * keyed by `EntryKind` only because the Receita tab's OWN form calls `Paid`
 * "Recebido" — the DRE and Indicadores toggles are a report-level control, and
 * the Figma spells them "Pago"/"Previsto" regardless of what kind of entry is
 * behind the number.
 */
export function StatusSwitch({
  value,
  onValueChange,
}: {
  value: EntryStatus
  onValueChange: (v: EntryStatus) => void
}) {
  return (
    <SegmentedControl
      value={value}
      onValueChange={onValueChange}
      options={STATUS_OPTIONS}
      aria-label="Status"
    />
  )
}
