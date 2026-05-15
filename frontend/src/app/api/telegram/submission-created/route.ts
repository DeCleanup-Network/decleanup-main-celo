/**
 * POST /api/telegram/submission-created
 *
 * After a successful onchain cleanup submit, the client calls this route so
 * verifiers get a real-time Telegram alert. The server re-reads the submission
 * from chain (must be Pending) before sending.
 *
 * Body: { submissionId: string, txHash?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/server/api-request-guards'
import { checkInMemoryRateLimit } from '@/lib/server/rate-limit'
import { isTelegramNotifierConfigured } from '@/lib/server/telegram-config'
import { notifyVerifiersOfNewSubmission } from '@/lib/server/telegram-submission-notify'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  submissionId: z.string().regex(/^\d+$/),
  txHash: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/)
    .optional(),
})

function tooManyRequests(resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
  return NextResponse.json(
    { error: 'Too many requests' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  )
}

export async function GET() {
  return NextResponse.json({
    configured: isTelegramNotifierConfigured(),
    hint: 'Set TELEGRAM_BOT_TOKEN and TELEGRAM_VERIFIER_CHAT_ID on the server.',
  })
}

export async function POST(request: NextRequest) {
  if (!isTelegramNotifierConfigured()) {
    return NextResponse.json(
      { ok: false, skipped: true, reason: 'telegram_not_configured' },
      { status: 200 }
    )
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'

  const rateLimit = checkInMemoryRateLimit({
    key: `telegram-submission:${ip}`,
    limit: 30,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return tooManyRequests(rateLimit.resetAt)
  }

  const parsed = await parseJsonBody(request, BodySchema)
  if (!parsed.ok) return parsed.response

  const { submissionId, txHash } = parsed.data

  try {
    const result = await notifyVerifiersOfNewSubmission({ submissionId, txHash })

    if (result.sent) {
      return NextResponse.json({ ok: true, sent: true, messageId: result.messageId })
    }

    return NextResponse.json({
      ok: true,
      sent: false,
      reason: result.reason,
      detail: result.detail,
    })
  } catch (e) {
    console.error('[telegram/submission-created]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Notification failed' },
      { status: 500 }
    )
  }
}
