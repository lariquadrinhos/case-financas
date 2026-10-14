'use client'

import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * One `QueryClient` per browser tab, created lazily inside `useState` so React
 * Strict Mode's double-render in development never creates two — a fresh
 * client per render would also mean losing cache between navigations.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Financial data changes when the person acts on it, not every
            // few seconds — refetch on demand (mutations invalidate), not on
            // a timer or on every window refocus.
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
