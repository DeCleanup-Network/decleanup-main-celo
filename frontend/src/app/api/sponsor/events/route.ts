import { NextRequest, NextResponse } from 'next/server'
import { getAddress, isAddress, type Address } from 'viem'
import {
  createSponsorEvent,
  isSponsorshipDbConfigured,
  listPendingSponsorEvents,
  listSponsorEvents,
} from '@/lib/supabase/sponsorship-events'
import { assertCanManageSponsorEvents } from '@/lib/sponsor/admin-auth'
import { getMaxImpactProductLevel } from '@/lib/sponsor/impact-product-level'
import { SPONSOR_CONFIG } from '@/config/sponsor'
import type { SponsorEventStatus } from '@/lib/sponsor/types'
import { apiErrorMessage, logApiError } from '@/lib/server/api-error'
import { enforceApiRateLimit } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    if (!isSponsorshipDbConfigured()) {
      return NextResponse.json({ error: 'Sponsorship database not configured', events: [] }, { status: 503 })
    }

    const pending = request.nextUrl.searchParams.get('status') === 'pending'
    if (pending) {
      try {
        assertCanManageSponsorEvents({
          walletAddress: request.headers.get('x-sponsor-admin-wallet'),
          adminSecret: request.headers.get('x-sponsor-admin-secret'),
        })
      } catch {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      }
      const events = await listPendingSponsorEvents()
      return NextResponse.json({ events })
    }

    const events = await listSponsorEvents()
    return NextResponse.json({ events })
  } catch (e) {
    logApiError('sponsor/events GET', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Failed to load events'), events: [] }, { status: 500 })
  }
}

type CreateBody = {
  name?: string
  location?: string
  organiser?: string
  eventDate?: string
  fundingGoalCusd?: number | string
  recipientAddress?: string
  verifiedCleanupsCount?: number
  status?: SponsorEventStatus
  walletAddress?: string
  /** Optional linked owner (e.g. smart account) for level merge. */
  onchainOwner?: string
  /** Public proposals are always stored as pending unless admin. */
  asProposal?: boolean
}

export async function POST(request: NextRequest) {
  try {
    if (!isSponsorshipDbConfigured()) {
      return NextResponse.json({ error: 'Sponsorship database not configured' }, { status: 503 })
    }

    const body = (await request.json()) as CreateBody
    const limited = await enforceApiRateLimit({
      request,
      scope: 'sponsor-events-create',
      maxRequests: 20,
      windowMs: 60_000,
      walletAddress: body.walletAddress || null,
    })
    if (!limited.ok) return limited.response

    const name = body.name?.trim() || ''
    const location = body.location?.trim() || ''
    const organiser = body.organiser?.trim() || ''
    const eventDate = body.eventDate?.trim() || ''
    const recipientAddress = body.recipientAddress?.trim() || ''
    const fundingGoalCusd =
      typeof body.fundingGoalCusd === 'number' ? body.fundingGoalCusd : Number(body.fundingGoalCusd)
    const walletAddress = body.walletAddress?.trim() || null
    const adminSecret = request.headers.get('x-sponsor-admin-secret')

    if (!name || !location || !organiser || !eventDate || !recipientAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!isAddress(recipientAddress)) {
      return NextResponse.json({ error: 'Invalid recipient address' }, { status: 400 })
    }
    if (!(fundingGoalCusd > 0) || !Number.isFinite(fundingGoalCusd)) {
      return NextResponse.json({ error: 'Invalid funding goal' }, { status: 400 })
    }

    const wantsPublish =
      !body.asProposal && (body.status === 'active' || body.status === 'upcoming' || body.status === 'ended')

    let status: SponsorEventStatus = 'pending'
    if (wantsPublish) {
      try {
        assertCanManageSponsorEvents({ walletAddress, adminSecret })
      } catch {
        return NextResponse.json(
          { error: 'Only allowlisted admins can publish events. Submit as a proposal instead.' },
          { status: 403 }
        )
      }
      status = body.status || 'upcoming'
    } else {
      // Community proposals: Impact Product level 5+
      if (!walletAddress || !isAddress(walletAddress)) {
        return NextResponse.json(
          { error: 'Connect a wallet to submit an event for funding.' },
          { status: 400 }
        )
      }
      const linked =
        body.onchainOwner && isAddress(body.onchainOwner) ? (getAddress(body.onchainOwner) as Address) : null
      const level = await getMaxImpactProductLevel(getAddress(walletAddress) as Address, linked)
      const minLevel = SPONSOR_CONFIG.minLevelToPropose
      if (level < minLevel) {
        return NextResponse.json(
          {
            error: `Reach Impact Product level ${minLevel} to submit events for funding (you are level ${level}).`,
            level,
            minLevel,
          },
          { status: 403 }
        )
      }
      status = 'pending'
    }

    const event = await createSponsorEvent({
      name,
      location,
      organiser,
      eventDate,
      fundingGoalCusd,
      recipientAddress,
      verifiedCleanupsCount: body.verifiedCleanupsCount,
      status,
      submittedBy: walletAddress && isAddress(walletAddress) ? walletAddress : null,
    })

    return NextResponse.json({ success: true, event }, { status: 201 })
  } catch (e) {
    logApiError('sponsor/events POST', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Failed to create event') }, { status: 500 })
  }
}
