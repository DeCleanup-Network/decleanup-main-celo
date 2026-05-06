/**
 * When Vercel hosts the UI but ML runs on ml.decleanup.net (GPU + disk),
 * set ML_BACKEND_ORIGIN + ML_PROXY_SHARED_SECRET on Vercel only.
 * These routes forward server-to-server; the browser still calls dapp.decleanup.net only.
 */

export type MlBackendProxyConfig = {
  enabled: boolean
  origin: string
  secret: string
}

export function getMlBackendProxyConfig(): MlBackendProxyConfig {
  const origin = (process.env.ML_BACKEND_ORIGIN || '').trim().replace(/\/+$/, '')
  const secret = (process.env.ML_PROXY_SHARED_SECRET || '').trim()
  return {
    enabled: Boolean(origin && secret),
    origin,
    secret,
  }
}

const PROXY_TIMEOUT_MS = Number(process.env.ML_BACKEND_PROXY_TIMEOUT_MS || 120_000)

export async function forwardMlVerifyPost(bodyText: string): Promise<Response> {
  const { origin, secret } = getMlBackendProxyConfig()
  if (!origin || !secret) {
    throw new Error('ML backend proxy not configured')
  }
  return fetch(`${origin}/api/ml-verification/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ml-proxy-secret': secret,
    },
    body: bodyText,
    signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
  })
}

export async function forwardMlResultGet(cleanupId: string): Promise<Response> {
  const { origin, secret } = getMlBackendProxyConfig()
  if (!origin || !secret) {
    throw new Error('ML backend proxy not configured')
  }
  const url = `${origin}/api/ml-verification/result?cleanupId=${encodeURIComponent(cleanupId)}`
  return fetch(url, {
    method: 'GET',
    headers: {
      'x-ml-proxy-secret': secret,
    },
    signal: AbortSignal.timeout(30_000),
  })
}
