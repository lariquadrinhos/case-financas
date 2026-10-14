import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { THEME_BOOTSTRAP } from '@/components/patterns/theme-toggle'
import { QueryProvider } from '@/lib/query-provider'
import { cn } from '@/lib/cn'
import '@/styles/globals.css'

export const metadata: Metadata = {
  // Só o nome (dono, 2026-10-01): o subtítulo "— Controle Financeiro PF + PJ" saiu.
  title: 'Bigorna',
  description: 'Registro de receitas, despesas e lucro de Pessoa Física e Pessoa Jurídica.',
  // Private financial data: never index, never generate a link preview.
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The nonce comes from `src/middleware.ts`, which also sets the CSP. Without
  // it the theme script would need `'unsafe-inline'`, which would equally allow
  // any injected script (ADR-0009 §2).
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    // The "geist" package (Vercel, self-hosted via next/font/local — never a
    // CDN, ADR-0009 §2) exposes each family as a CSS variable rather than a
    // font-family value directly, so it can be attached once here and read by
    // `--font-sans` / `--font-mono` in tokens.css from anywhere in the tree.
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={cn(GeistSans.variable, GeistMono.variable)}
    >
      <head>
        {/* Runs before first paint so the page never flashes the light theme
            and then flips. `suppressHydrationWarning` above is required because
            this script mutates <html> before React sees it. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
