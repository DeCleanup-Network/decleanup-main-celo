import { NextRequest, NextResponse } from 'next/server'
import {
  getSponsorEventById,
  isSponsorshipDbConfigured,
  updateSponsorEventStatus,
} from '@/lib/supabase/sponsorship-events'
import { assertCanManageSponsorEvents } from '@/lib/sponsor/admin-auth'
import type { SponsorEventStatus } from '@/lib/sponsor/types'
import { apiErrorMessage, logApiError } from '@/lib/server/api-error'
import { enforceApiRateLimit } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    if (!isSponsorshipDbConfigured()) {
      return NextResponse.json({ error: 'Sponsorship database not configured' }, { status: 503 })
    }
    const { id } = context.params
    const event = await getSponsorEventById(id)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    // Public share: hide pending recipient until published
    if (event.status === 'pending') {
      return NextResponse.json({
        event: {
          ...event,
          recipientAddress: '',
          amountRaisedCusd: 0,
        },
        openForDonations: false,
      })
    }
    return NextResponse.json({
      event,
      openForDonations: event.status === 'active' || event.status === 'upcoming',
    })
  } catch (e) {
    logApiError('sponsor/events/[id] GET', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Failed to load event') }, { status: 500 })
  }
}

type Body = {
  status?: SponsorEventStatus
  walletAddress?: string
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    if (!isSponsorshipDbConfigured()) {
      return NextResponse.json({ error: 'Sponsorship database not configured' }, { status: 503 })
    }

    const { id } = context.params
    const body = (await request.json()) as Body
    const limited = await enforceApiRateLimit({
      request,
      scope: 'sponsor-events-patch',
      maxRequests: 40,
      windowMs: 60_000,
      walletAddress: body.walletAddress || null,
    })
    if (!limited.ok) return limited.response

    try {
      assertCanManageSponsorEvents({
        walletAddress: body.walletAddress,
        adminSecret: request.headers.get('x-sponsor-admin-secret'),
      })
    } catch {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    if (!body.status) {
      return NextResponse.json({ error: 'status required' }, { status: 400 })
    }

    const event = await updateSponsorEventStatus(id, body.status)
    return NextResponse.json({ success: true, event })
  } catch (e) {
    logApiError('sponsor/events/[id] PATCH', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Failed to update event') }, { status: 500 })
  }
}
