import { NextRequest, NextResponse } from 'next/server'
import { resolveCeloSepoliaUpstreamRpc, CELO_SEPOLIA_FORNO_RPC } from '@/lib/blockchain/celo-sepolia-upstream-rpc'
import { checkInMemoryRateLimit, getRateLimitKey } from '@/lib/server/rate-limit'
import { MAX_RPC_PROXY_BODY_BYTES, rejectIfContentLengthExceeds } from '@/lib/server/api-request-guards'

export const runtime = 'nodejs'

const RPC_UPSTREAM_TIMEOUT_MS = 60_000

/**
 * Same-origin JSON-RPC proxy so the browser never calls public Celo RPCs directly
 * (many return no Access-Control-Allow-Origin and fail with "access control checks").
 */
const UPSTREAM = resolveCeloSepoliaUpstreamRpc(
  process.env.CELO_SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    CELO_SEPOLIA_FORNO_RPC
)

/** Web3Auth embedded wallet runs in an iframe on *.web3auth.io and POSTs JSON-RPC to this URL — needs CORS. */
function isWeb3AuthOrigin(origin: string | null): boolean {
  if (!origin || !origin.startsWith('https://')) return false
  try {
    const { hostname } = new URL(origin)
    return hostname === 'web3auth.io' || hostname.endsWith('.web3auth.io')
  } catch {
    return false
  }
}

function normalizeOrigin(value: string | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function isAllowedAppOrigin(origin: string): boolean {
  const configured = new Set(
    [
      normalizeOrigin(process.env.NEXT_PUBLIC_WEB_APP_URL),
      normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL),
      normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL),
    ].filter((v): v is string => Boolean(v))
  )
  return configured.has(origin)
}

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin')
  if (!origin) return {}
  if (!isWeb3AuthOrigin(origin) && !isAllowedAppOrigin(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    Vary: 'Origin',
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) })
}

export async function POST(req: NextRequest) {
  const walletAddress =
    req.headers.get('x-wallet-address') ||
    req.headers.get('x-address') ||
    null
  const rateLimit = checkInMemoryRateLimit({
    key: getRateLimitKey(req, walletAddress),
    // Dev dashboard makes many parallel reads; keep stricter limits outside dev.
    maxRequests: process.env.NODE_ENV === 'development' ? 200 : 60,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))
    return NextResponse.json(
      {
        error: 'Too many requests',
        retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds),
          ...corsHeaders(req),
        },
      }
    )
  }

  const tooLarge = rejectIfContentLengthExceeds(req, MAX_RPC_PROXY_BODY_BYTES)
  if (tooLarge) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413, headers: corsHeaders(req) })
  }

  const ct = (req.headers.get('content-type') || '').toLowerCase()
  if (ct && !ct.includes('application/json') && !ct.includes('text/plain')) {
    return NextResponse.json(
      { error: 'Unsupported Content-Type for JSON-RPC' },
      { status: 415, headers: corsHeaders(req) }
    )
  }

  let body: string
  try {
    body = await req.text()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400, headers: corsHeaders(req) })
  }

  const upstream = await fetch(UPSTREAM, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(RPC_UPSTREAM_TIMEOUT_MS),
  })

  const text = await upstream.text()
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(req),
    },
  })
}
