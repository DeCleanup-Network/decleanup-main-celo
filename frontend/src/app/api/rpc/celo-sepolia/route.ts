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

export async function POST(req: NextRequest) {
  let body: string
  try {
    body = await req.text()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
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
    },
  })
}
