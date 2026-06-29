import 'server-only'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

type LimitResult = { ok: boolean; remaining: number; resetAt: number }

const limiters = new Map<string, Ratelimit>()

function upstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  )
}

function getLimiter(maxRequests: number, windowMs: number): Ratelimit {
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000))
  const cacheKey = `${maxRequests}:${windowSec}`
  const existing = limiters.get(cacheKey)
  if (existing) return existing

  const limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowSec} s`),
    prefix: 'dcu_rl',
    analytics: false,
  })
  limiters.set(cacheKey, limiter)
  return limiter
}

export async function checkUpstashRateLimit(params: {
  key: string
  maxRequests: number
  windowMs: number
}): Promise<LimitResult | null> {
  if (!upstashConfigured()) return null

  try {
    const limiter = getLimiter(params.maxRequests, params.windowMs)
    const result = await limiter.limit(params.key)
    return {
      ok: result.success,
      remaining: result.remaining,
      resetAt: result.reset,
    }
  } catch (e) {
    console.error('[rate-limit] Upstash error, falling back to in-memory:', e)
    return null
  }
}

export function isUpstashRateLimitConfigured(): boolean {
  return upstashConfigured()
}
