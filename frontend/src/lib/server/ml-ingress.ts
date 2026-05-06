import { NextRequest, NextResponse } from 'next/server'

/**
 * On the ML host (ml.decleanup.net), require x-ml-proxy-secret when ML_PROXY_SHARED_SECRET is set.
 * Omit the env on a dev-only VPS to allow local testing without the header.
 */
export function rejectUnauthorizedMlIngress(request: NextRequest): NextResponse | null {
  const expected = process.env.ML_PROXY_SHARED_SECRET?.trim()
  if (!expected) {
    return null
  }
  const got = request.headers.get('x-ml-proxy-secret')?.trim()
  if (got !== expected) {
    return NextResponse.json({ error: 'Unauthorized', message: 'Invalid or missing ML proxy secret' }, { status: 401 })
  }
  return null
}
