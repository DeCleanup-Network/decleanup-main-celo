import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkInMemoryRateLimit, getClientIp, getRateLimitKey } from '@/lib/server/edge-rate-limit'
import {
  classifyGoogleCrawler,
  isScannerProbePath,
  shouldBlockSpoofedGooglebot,
} from '@/lib/server/googlebot'

/**
 * Edge gate: scanner-path 404, spoofed-Googlebot write block, wallet API rate limits.
 * User-Agent is never trusted alone — Google crawlers must match published CIDRs.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isScannerProbePath(pathname)) {
    return new NextResponse(null, { status: 404 })
  }

  const crawler = classifyGoogleCrawler(request.headers.get('user-agent'), getClientIp(request))
  if (crawler === 'spoofed' && shouldBlockSpoofedGooglebot(pathname, request.method)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

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
  // Do not match `/` or `/_not-found` — a catch-all Edge matcher pulled Node
  // Upstash into the middleware graph and broke `next build` prerender.
  matcher: [
    '/api/:path*',
    '/.env',
    '/.env.local',
    '/.env.production',
    '/.env.development',
    '/.git',
    '/.git/:path*',
    '/.svn/:path*',
    '/.hg/:path*',
    '/.DS_Store',
    '/.htaccess',
    '/.htpasswd',
    '/.aws/:path*',
    '/wp-admin',
    '/wp-admin/:path*',
    '/wp-login.php',
    '/wp-config.php',
    '/xmlrpc.php',
    '/phpmyadmin',
    '/phpmyadmin/:path*',
    '/pma',
    '/pma/:path*',
    '/phpinfo.php',
    '/vendor/phpunit/:path*',
    '/actuator/:path*',
    '/server-status',
    '/cgi-bin',
    '/cgi-bin/:path*',
    '/backup.sql',
    '/dump.sql',
    '/config.php',
  ],
}
