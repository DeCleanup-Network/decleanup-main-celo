import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { enforceApiRateLimit } from '@/lib/server/rate-limit'
import { apiErrorMessage, logApiError } from '@/lib/server/api-error'
import { isRdcuServerSettleConfigured, settleRobinhoodRdcuOnServer } from '@/lib/server/rdcu-settle'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Permissionless $rDCU settle, paid by the server so wallets only sign approve or tRWI. */
export async function POST(request: NextRequest) {
  try {
    if (!isRdcuServerSettleConfigured()) {
      return NextResponse.json({ error: 'Settle not configured', configured: false }, { status: 503 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      submissionId?: string
      user?: string
    }
    const submissionId = body.submissionId?.trim()
    const user = body.user?.trim()
    if (!submissionId && !user) {
      return NextResponse.json({ error: 'submissionId or user required' }, { status: 400 })
    }
    if (user && !isAddress(user)) {
      return NextResponse.json({ error: 'Invalid user' }, { status: 400 })
    }
    if (submissionId && !/^\d+$/.test(submissionId)) {
      return NextResponse.json({ error: 'Invalid submissionId' }, { status: 400 })
    }

    const limited = await enforceApiRateLimit({
      request,
      scope: 'rdcu-settle',
      maxRequests: 20,
      windowMs: 60_000,
      walletAddress: user || null,
    })
    if (!limited.ok) return limited.response

    const result = await settleRobinhoodRdcuOnServer({ submissionId, user })
    return NextResponse.json({ success: true, hashes: result.hashes })
  } catch (e) {
    logApiError('rdcu/settle', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Settle failed') }, { status: 500 })
  }
}
