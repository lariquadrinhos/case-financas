import { describe, expect, it } from 'vitest'
import { cn } from './cn'

/**
 * Regression for a real, silent visual bug found while reviewing Detalhe do
 * Passivo's Evolução da Dívida chart (files_design/08 §3.6): its "hoje"
 * label used `cn('text-center text-style-label-xs', 'text-ink-primary')` and
 * rendered at the browser's default text size, in mixed case, instead of the
 * design system's uppercase `label.xs` — because stock `tailwind-merge`
 * groups `text-style-*` (a component class from `src/styles/globals.css`,
 * unknown to `tailwind-merge`'s stock config) together with `text-color`
 * classes and drops whichever came first. Same defect independently found in
 * `src/app/(app)/revisao-de-recorrentes/_components/edit-occurrence-dialog.tsx`'s
 * scope radio option (`text-style-body-md text-ink-primary` in one `cn()`
 * call) — this test protects every caller, not just those two.
 */
describe('cn — text-style-* must never lose a conflict to a text colour class', () => {
  it('keeps a text-style-* class alongside a text-ink-* colour class', () => {
    expect(cn('text-style-body-md', 'text-ink-primary')).toBe('text-style-body-md text-ink-primary')
  })

  it('keeps a text-style-* class regardless of argument order', () => {
    expect(cn('text-ink-secondary', 'text-style-label-xs')).toBe(
      'text-ink-secondary text-style-label-xs',
    )
  })

  it('keeps text-style-* alongside utilities from the SAME call, like the real chart label', () => {
    expect(cn('text-center text-style-label-xs', 'text-ink-primary')).toBe(
      'text-center text-style-label-xs text-ink-primary',
    )
  })

  it('still resolves a genuine conflict BETWEEN two text-style-* classes (last one wins)', () => {
    expect(cn('text-style-body-md', 'text-style-body-sm')).toBe('text-style-body-sm')
  })

  it('still resolves a genuine conflict between two plain text colour classes (unaffected by the fix)', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })
})
