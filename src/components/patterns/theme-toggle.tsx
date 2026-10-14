'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * Theme toggle — Figma node 507:63 "Alternador de tema", 84×44, sitting at the
 * top of the sidebar next to the product name.
 *
 * Two states, not three: files_design/02 §"Controle de tema (claro/escuro)"
 * evaluated a 3-state hybrid (Automático/Claro/Escuro) and rejected it by name
 * — "adiciona complexidade de interação... sem um motivo concreto do produto" —
 * in favour of a plain manual toggle (files_design/07 §Biblioteca de
 * componentes, "Alternador de tema — Estado (Claro, Escuro), 2 variantes").
 * ADR-0011 §5 ("Três estados de tema, não dois") predates that product
 * decision and has been amended to match; it no longer describes this
 * component.
 *
 * Because the mechanic is explicitly "a mesma do Controle segmentado... sempre
 * tem um item ativo" (doc07), exactly one of the two icons is always the
 * active one once mounted — there is no third, unmarked state to fall back
 * to. Before an explicit choice exists in storage, the initially-active icon
 * resolves from `prefers-color-scheme` purely so the highlighted icon matches
 * the colours `tokens.css` already renders (its `@media` block, unchanged by
 * this component) — it is not a selectable "Automático" option, and the first
 * click always turns it into a stored, explicit choice.
 *
 * The choice is stored in `localStorage`, not a cookie: it is a display
 * preference with no server-side use, and keeping it out of the request means
 * it never travels with financial data (ADR-0009 §4, minimisation).
 */

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'bigorna.theme'

/**
 * Runs before paint, injected inline by the layout with the CSP nonce. Kept as
 * a string because it has to execute before React hydrates — otherwise the page
 * paints light and then flips, which is worse than no toggle at all.
 */
export const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})()`

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    return null
  }
}

// Only used to resolve which icon is already active before any explicit
// choice was ever made — see the component doc comment above.
function resolveSystemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = React.useState<Theme>('light')
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setTheme(readStoredTheme() ?? resolveSystemTheme())
    setMounted(true)
  }, [])

  function choose(next: Theme) {
    setTheme(next)
    applyTheme(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // A blocked storage (private mode) must not break the toggle for this session.
    }
  }

  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Tema claro', icon: <SunIcon /> },
    { value: 'dark', label: 'Tema escuro', icon: <MoonIcon /> },
  ]

  return (
    <div
      role="group"
      aria-label="Tema"
      className={cn(
        'inline-flex items-center gap-4 rounded-control border border-line-default bg-surface-subtle p-4',
        className,
      )}
    >
      {options.map((option) => {
        // Before mount the stored value is unknown, so nothing is marked active.
        // Rendering a guess here would produce a hydration mismatch.
        const active = mounted && theme === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => choose(option.value)}
            aria-pressed={active}
            title={option.label}
            className={cn(
              // files_design/07 "Alternador de tema": mesma mecânica do
              // Controle segmentado — trilho bg/subtle, ícone ativo ganha
              // fundo bg/card e cor text/primary; o inativo fica em
              // text/secondary.
              'inline-flex h-[var(--space-32)] w-[var(--space-32)] items-center justify-center',
              'rounded-control text-ink-secondary transition-colors',
              'hover:bg-surface-card hover:text-ink-primary',
              active && 'bg-surface-card text-ink-primary',
            )}
          >
            {option.icon}
            <span className="sr-only">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/* Icons are inline SVG rather than an icon package: the CSP forbids external
   resources, and two glyphs do not justify a dependency. `currentColor` makes
   them follow the button's text colour in both themes. */

function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="3.25" />
      <path d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.95 3.05l-1.06 1.06M4.11 11.89l-1.06 1.06M12.95 12.95l-1.06-1.06M4.11 4.11L3.05 3.05" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1Z" />
    </svg>
  )
}
