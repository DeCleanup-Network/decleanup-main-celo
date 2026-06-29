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
import { rejectOpsDiagnosticUnlessAuthorized } from '@/lib/server/ops-diagnostic-guard'
import {
  CONTRACT_ADDRESSES,
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
} from '@/lib/blockchain/chain-constants'
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

export async function GET(request: NextRequest) {
  const blocked = rejectOpsDiagnosticUnlessAuthorized(request)
  if (blocked) return blocked

  return NextResponse.json({
    configured: isTelegramNotifierConfigured(),
    chainId: REQUIRED_CHAIN_ID,
    chainName: REQUIRED_CHAIN_NAME,
    submissionContract: CONTRACT_ADDRESSES.VERIFICATION || null,
  })
}

export async function POST(request: NextRequest) {
  if (!isTelegramNotifierConfigured()) {
    console.warn('[telegram/submission-created] skipped: telegram_not_configured')
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
    maxRequests: 30,
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

    console.warn('[telegram/submission-created] not sent:', result.reason, result.detail ?? '')
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
