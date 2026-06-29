import { NextRequest } from 'next/server'
import { checkUpstashRateLimit } from '@/lib/server/upstash-rate-limit'

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }

  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  return 'unknown'
}

export function getRateLimitKey(req: NextRequest, walletAddress?: string | null): string {
  const ip = getClientIp(req)
  const wallet = walletAddress?.trim().toLowerCase() || 'anon'
  return `${ip}:${wallet}`
}

export function checkInMemoryRateLimit(params: {
  key: string
  maxRequests: number
  windowMs: number
}): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const current = buckets.get(params.key)

  if (!current || now >= current.resetAt) {
    const next: Bucket = { count: 1, resetAt: now + params.windowMs }
    buckets.set(params.key, next)
    return { ok: true, remaining: params.maxRequests - 1, resetAt: next.resetAt }
  }

  if (current.count >= params.maxRequests) {
    return { ok: false, remaining: 0, resetAt: current.resetAt }
  }

  current.count += 1
  buckets.set(params.key, current)
  return { ok: true, remaining: params.maxRequests - current.count, resetAt: current.resetAt }
}

export function tooManyRequestsResponse(resetAt: number): Response {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
      },
    }
  )
}

type RateLimitResult = { ok: true } | { ok: false; response: Response }

/**
 * Global rate limit (Upstash when configured, else in-memory per instance).
 * Use on unauthenticated write endpoints (claims, hypercerts, verifier apply).
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

