import { NextRequest } from 'next/server'
import { checkUpstashRateLimit } from '@/lib/server/upstash-rate-limit'
import {
  checkInMemoryRateLimit,
  getRateLimitKey,
  tooManyRequestsResponse,
} from '@/lib/server/edge-rate-limit'

export {
  checkInMemoryRateLimit,
  getClientIp,
  getRateLimitKey,
  tooManyRequestsResponse,
} from '@/lib/server/edge-rate-limit'

type RateLimitResult = { ok: true } | { ok: false; response: Response }

/**
 * Global rate limit (Upstash when configured, else in-memory per instance).
 * Node runtime only — middleware must import from edge-rate-limit instead.
 */
export async function enforceApiRateLimit(params: {
  request: NextRequest
  scope: string
  maxRequests: number
  windowMs: number
  walletAddress?: string | null
}): Promise<RateLimitResult> {
  const key = `${getRateLimitKey(params.request, params.walletAddress ?? null)}:${params.scope}`

  const upstash = await checkUpstashRateLimit({
    key,
    maxRequests: params.maxRequests,
    windowMs: params.windowMs,
  })

  const result =
    upstash ??
    checkInMemoryRateLimit({
      key,
      maxRequests: params.maxRequests,
      windowMs: params.windowMs,
    })

  if (!result.ok) {
    return { ok: false, response: tooManyRequestsResponse(result.resetAt) }
  }
  return { ok: true }
}
