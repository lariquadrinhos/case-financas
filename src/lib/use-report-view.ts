'use client'

import * as React from 'react'
import type { View } from '@/domain/core'

/**
 * "Visão" (Consolidado/PF/PJ) is shared state across the four report screens
 * — files_design/03 "Relatórios — parâmetros comuns": Default = "última visão
 * usada (persistida)", one row for all four, not one preference per screen.
 * Switching to PF on the DRE and then opening Indicadores Financeiros should
 * already show PF, not reset to Consolidado.
 *
 * `localStorage`, same reasoning as the theme toggle
 * (`components/patterns/theme-toggle.tsx`): a display preference with no
 * server-side use, kept out of the request so it never travels alongside
 * financial data (ADR-0009 §4).
 */

const VIEW_STORAGE_KEY = 'bigorna.report-view'
const DEFAULT_VIEW: View = 'Consolidated'

function readStoredView(): View {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY)
    return stored === 'Consolidated' || stored === 'PF' || stored === 'PJ' ? stored : DEFAULT_VIEW
  } catch {
    return DEFAULT_VIEW
  }
}

export function useReportView(): readonly [View, (next: View) => void] {
  // Rendered the same on the server and on first client paint (`Consolidated`)
  // to avoid a hydration mismatch — the real stored value, if any, is only
  // knowable after mount (same pattern as `ThemeToggle`).
  const [view, setView] = React.useState<View>(DEFAULT_VIEW)

  React.useEffect(() => {
    setView(readStoredView())
  }, [])

  const changeView = React.useCallback((next: View) => {
    setView(next)
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next)
    } catch {
      // A blocked store (private mode) must not break the switch for this session.
    }
  }, [])

  return [view, changeView] as const
}
