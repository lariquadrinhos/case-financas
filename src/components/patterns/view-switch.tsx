'use client'

import { LABEL_VIEW, VIEWS, type View } from '@/domain/core'
import { SegmentedControl } from '@/components/patterns/segmented-control'

const VIEW_OPTIONS = VIEWS.map((view) => ({ value: view, label: LABEL_VIEW[view] }))

/**
 * Consolidado/PF/PJ — files_design/07 "Controle segmentado", the example the
 * doc itself gives for the component (`segmented/3/1`). Present, in this exact
 * order, on all four report screens (files_design/01 §8: "Padrão comum aos 4
 * relatórios: seletor de visão").
 */
export function ViewSwitch({
  value,
  onValueChange,
}: {
  value: View
  onValueChange: (v: View) => void
}) {
  return (
    <SegmentedControl
      value={value}
      onValueChange={onValueChange}
      options={VIEW_OPTIONS}
      aria-label="Visão"
    />
  )
}
