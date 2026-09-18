import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'viem'
import {
  isSponsorshipDbConfigured,
  recordSponsorship,
} from '@/lib/supabase/sponsorship-events'
import { apiErrorMessage, logApiError } from '@/lib/server/api-error'
import { enforceApiRateLimit } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = {
  eventId?: string
  sponsorAddress?: string
  amountCusd?: number | string
  txHash?: string
}

export async function POST(request: NextRequest) {
  try {
    if (!isSponsorshipDbConfigured()) {
      return NextResponse.json({ error: 'Sponsorship database not configured' }, { status: 503 })
    }

    const body = (await request.json()) as Body

    const limited = await enforceApiRateLimit({
      request,
      scope: 'sponsor-record',
      maxRequests: 30,
      windowMs: 60_000,
      walletAddress: body.sponsorAddress || null,
    })
    if (!limited.ok) return limited.response

    const eventId = body.eventId?.trim()
    const sponsorAddress = body.sponsorAddress?.trim()
    const txHash = body.txHash?.trim()
    const amountCusd = typeof body.amountCusd === 'number' ? body.amountCusd : Number(body.amountCusd)

    if (!eventId || !sponsorAddress || !txHash) {
      return NextResponse.json(
        { error: 'eventId, sponsorAddress, and txHash are required' },
        { status: 400 }
      )
    }
    if (!isAddress(sponsorAddress)) {
      return NextResponse.json({ error: 'Invalid sponsor address' }, { status: 400 })
    }
    if (!(amountCusd > 0) || !Number.isFinite(amountCusd)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const result = await recordSponsorship({
      eventId,
      sponsorAddress,
      amountCusd,
      txHash,
    })

    return NextResponse.json({ success: true, id: result.id })
  } catch (e) {
    logApiError('sponsor/record POST', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Failed to record sponsorship') }, { status: 500 })
  }
}
