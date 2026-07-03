import { NextRequest, NextResponse } from 'next/server'
import { getMlBackendProxyConfig } from '@/lib/server/ml-backend-proxy'

/**
 * On the ML host (ml.decleanup.net / VPS), require x-ml-proxy-secret when ML_PROXY_SHARED_SECRET is set.
 * On Vercel (ML_BACKEND_ORIGIN set), skip — the dapp receives public verify requests and adds the
 * header when forwarding server-to-server to the ML host.
 */
export function rejectUnauthorizedMlIngress(request: NextRequest): NextResponse | null {
  if (getMlBackendProxyConfig().enabled) {
    return null
  }
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
