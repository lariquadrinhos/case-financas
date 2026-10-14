import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * The 8 typography component classes `src/styles/globals.css` defines
 * (`.text-style-heading-xl` … `.text-style-code-sm`) — kept in sync with that
 * file by hand, there being no build step that shares the list between CSS
 * and this config.
 *
 * `tailwind-merge`'s stock config has no idea these exist: it parses
 * `text-style-body-md` as `text` + an arbitrary "colour" suffix (its
 * catch-all fallback for anything after `text-` that isn't a known
 * `font-size` keyword), landing it in the SAME conflict group as
 * `text-ink-primary`. Any `cn('text-style-body-md text-ink-primary')` call
 * — exactly the pairing this design system uses on almost every styled text
 * node — then has stock `twMerge` silently DROP the typography class and
 * keep only the colour, because its "last one in a group wins" rule fires on
 * a group the two classes were never meant to share (verified directly:
 * `twMerge('text-style-body-md text-ink-primary')` → `'text-ink-primary'`).
 * The visible symptom is a text node that renders at the browser default
 * size/weight/case instead of the design system's, with no error anywhere.
 *
 * Registering `text-style` as its OWN class group below fixes it at the
 * root: typography and colour classes stop competing, while two
 * `text-style-*` classes in the same call still correctly conflict with each
 * other (last one wins, same as any other Tailwind group) — see
 * `src/lib/cn.test.ts`.
 */
const TEXT_STYLE_NAMES = [
  'heading-xl',
  'heading-sm',
  'body-md',
  'body-sm',
  'label-xs',
  'numeric-md',
  'numeric-lg',
  'code-sm',
] as const

const twMerge = extendTailwindMerge<'text-style'>({
  extend: {
    classGroups: {
      'text-style': [{ 'text-style': [...TEXT_STYLE_NAMES] }],
    },
  },
})

/** Junta classes resolvendo conflitos do Tailwind (última vence). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
