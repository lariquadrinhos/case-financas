import { isoDate, type IsoDate } from '@/domain/core'

/**
 * The device's "hoje", read once at the screen boundary — the domain never
 * reads a clock (src/domain/README.md). Kept local to this feature rather than
 * a shared `src/lib` helper: that module is being reshaped concurrently by
 * another group's work on the report screens, and this group only ever needs
 * the one default-date case (Passivos "Data de início").
 */
export function todayIsoDate(): IsoDate {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return isoDate(`${y}-${m}-${d}`)
}
