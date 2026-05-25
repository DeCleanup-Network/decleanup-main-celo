import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkInMemoryRateLimit, getRateLimitKey } from '@/lib/server/rate-limit'

/**
 * Edge rate limiting for wallet APIs. In-memory buckets are per-instance on serverless
 * but still slow credential stuffing and challenge spam. Prefer Upstash for strict global limits.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/api/passkey') ||
    pathname.startsWith('/api/aa') ||
    pathname.startsWith('/api/auth/wallet')
  ) {
    const scope = pathname.startsWith('/api/passkey')
      ? 'passkey'
      : pathname.startsWith('/api/auth/wallet')
        ? 'wallet-auth'
        : 'aa'
    const key = `${getRateLimitKey(request)}:mw:${scope}`
    const limit = checkInMemoryRateLimit({
      key,
      maxRequests: scope === 'passkey' ? 25 : scope === 'wallet-auth' ? 30 : 40,
      windowMs: 60_000,
    })
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfterSeconds: Math.ceil((limit.resetAt - Date.now()) / 1000) },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/passkey/:path*', '/api/aa/:path*', '/api/auth/wallet/:path*'],
}
