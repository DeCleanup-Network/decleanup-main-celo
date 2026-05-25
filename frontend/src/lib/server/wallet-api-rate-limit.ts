import type { NextRequest } from 'next/server'
import {
  checkInMemoryRateLimit,
  getRateLimitKey,
  tooManyRequestsResponse,
} from '@/lib/server/rate-limit'

type RateLimitResult =
  | { ok: true }
  | { ok: false; response: Response }

/** Rate limits for wallet/passkey APIs (brute-force + abuse protection). */
export function enforceWalletApiRateLimit(
  request: NextRequest,
  scope: 'passkey' | 'aa-wallet',
  userId?: string | null
): RateLimitResult {
  const action = scope === 'passkey' ? 'passkey' : 'aa'
  const key = `${getRateLimitKey(request, userId ?? null)}:${action}`
  const limits =
    scope === 'passkey'
      ? { maxRequests: 40, windowMs: 60_000 }
      : { maxRequests: 60, windowMs: 60_000 }

  const result = checkInMemoryRateLimit({ key, ...limits })
  if (!result.ok) {
    return { ok: false, response: tooManyRequestsResponse(result.resetAt) }
  }
  return { ok: true }
}
