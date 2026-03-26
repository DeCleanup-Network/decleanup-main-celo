import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Same-origin JSON-RPC proxy so the browser never calls public Celo RPCs directly
 * (many return no Access-Control-Allow-Origin and fail with "access control checks").
 * Upstream is server-only or public drpc by default.
 */
const UPSTREAM =
  process.env.CELO_SEPOLIA_RPC_URL ||
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
  'https://celo-sepolia.drpc.org'

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

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin')
  if (!origin || !isWeb3AuthOrigin(origin)) return {}
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
