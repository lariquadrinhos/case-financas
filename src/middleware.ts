import { NextResponse, type NextRequest } from 'next/server'

/**
 * Per-request CSP with a nonce — ADR-0009 §2.
 *
 * The CSP lives here rather than in `next.config.ts` because a nonce has to be
 * generated per request. Without a nonce the only way to let the theme
 * bootstrap script run would be `'unsafe-inline'`, which would also let any
 * injected inline script run — the exact thing the policy exists to stop.
 *
 * Next.js reads the nonce back out of this header and stamps it onto its own
 * scripts automatically, so no framework script needs an exception.
 *
 * `strict-dynamic` lets the scripts loaded BY a nonced script run too, which is
 * how Next's chunk loading works. Older browsers ignore it and fall back to the
 * host allowlist, which here is `'self'` only.
 *
 * `connect-src 'self'` is the line that matters most for this product: even a
 * compromised dependency cannot ship financial data to another origin.
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const isProduction = process.env.NODE_ENV === 'production'

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProduction ? '' : " 'unsafe-eval'"}`,
    // Tailwind and Next inject style elements at runtime; a nonce on those is
    // not reliably propagated, and style injection is not a data-exfiltration
    // path the way script injection is.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${isProduction ? '' : ' ws: http://localhost:*'}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProduction ? ['upgrade-insecure-requests'] : []),
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    // Everything except Next's static output, which is served with its own
    // headers and cannot execute a script.
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [{ type: 'header', key: 'next-router-prefetch' }],
    },
  ],
}
