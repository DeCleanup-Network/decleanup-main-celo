import { NextRequest, NextResponse } from 'next/server'
import { getAddress, isAddress } from 'viem'
import {
  getSponsorEventById,
  isSponsorshipDbConfigured,
  updateSponsorEventFields,
  updateSponsorEventStatus,
} from '@/lib/supabase/sponsorship-events'
import { assertCanManageSponsorEvents, isSponsorAdminWallet } from '@/lib/sponsor/admin-auth'
import { isSponsorEventOwner } from '@/lib/sponsor/edit-auth'
import {
  cryptoRecipientFromMethods,
  parsePaymentMethods,
  validatePaymentMethods,
} from '@/lib/sponsor/payment-methods'
import { SPONSOR_CONFIG } from '@/config/sponsor'
import type { SponsorEventStatus } from '@/lib/sponsor/types'
import { apiErrorMessage, logApiError } from '@/lib/server/api-error'
import { enforceApiRateLimit } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!isSponsorshipDbConfigured()) {
      return NextResponse.json({ error: 'Sponsorship database not configured' }, { status: 503 })
    }
    const { id } = await context.params
    const event = await getSponsorEventById(id)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    const editor =
      request.nextUrl.searchParams.get('wallet') || request.headers.get('x-sponsor-editor-wallet')
    const canSeePrivate =
      isSponsorEventOwner(event, editor) || isSponsorAdminWallet(editor)
    // Public share: hide pending recipient until published
    if (event.status === 'pending' && !canSeePrivate) {
      return NextResponse.json({
        event: {
          ...event,
          recipientAddress: '',
          amountRaisedCusd: 0,
        },
        openForDonations: false,
        canEdit: false,
      })
    }
    return NextResponse.json({
      event,
      openForDonations: event.status === 'active' || event.status === 'upcoming',
      canEdit: Boolean(canSeePrivate),
    })
  } catch (e) {
    logApiError('sponsor/events/[id] GET', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Failed to load event') }, { status: 500 })
  }
}

type Body = {
  status?: SponsorEventStatus
  walletAddress?: string
  name?: string
  location?: string
  organiser?: string
  eventDate?: string | null
  fundingGoalCusd?: number | string
  recipientAddress?: string
  whyFunding?: string
  communitySize?: string
  eventFrequency?: string
  impactSummary?: string
  socialLinks?: string
  impactPortfolioUrl?: string
  paymentMethods?: unknown
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!isSponsorshipDbConfigured()) {
      return NextResponse.json({ error: 'Sponsorship database not configured' }, { status: 503 })
    }

    const { id } = await context.params
    const body = (await request.json()) as Body
    const limited = await enforceApiRateLimit({
      request,
      scope: 'sponsor-events-patch',
      maxRequests: 40,
      windowMs: 60_000,
      walletAddress: body.walletAddress || null,
    })
    if (!limited.ok) return limited.response

    const existing = await getSponsorEventById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const wallet = body.walletAddress?.trim() || ''
    let isAdmin = false
    try {
      assertCanManageSponsorEvents({
        walletAddress: wallet,
        adminSecret: request.headers.get('x-sponsor-admin-secret'),
      })
      isAdmin = true
    } catch {
      isAdmin = false
    }
    const isOwner = isSponsorEventOwner(existing, wallet)
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Not authorized to edit this campaign' }, { status: 403 })
    }

    if (body.status) {
      if (!isAdmin) {
        return NextResponse.json({ error: 'Only a reviewer can change campaign status' }, { status: 403 })
      }
      const event = await updateSponsorEventStatus(id, body.status, isAddress(wallet) ? getAddress(wallet) : null)
      return NextResponse.json({ success: true, event })
    }

    const name = body.name?.trim() || ''
    const location = body.location?.trim() || ''
    const whyFunding = body.whyFunding?.trim() || ''
    const fundingGoalCusd =
      typeof body.fundingGoalCusd === 'number' ? body.fundingGoalCusd : Number(body.fundingGoalCusd)
    const paymentMethods = parsePaymentMethods(body.paymentMethods)
    const paymentError = validatePaymentMethods(paymentMethods)
    if (!name || !location || !whyFunding) {
      return NextResponse.json({ error: 'Fill campaign name, location, and why you need funding.' }, { status: 400 })
    }
    if (whyFunding.length > SPONSOR_CONFIG.whyFundingMaxChars) {
      return NextResponse.json(
        { error: `Why you need funding must be ${SPONSOR_CONFIG.whyFundingMaxChars} characters or fewer.` },
        { status: 400 }
      )
    }
    if (paymentError) {
      return NextResponse.json({ error: paymentError }, { status: 400 })
    }
    if (!(fundingGoalCusd > 0) || !Number.isFinite(fundingGoalCusd)) {
      return NextResponse.json({ error: 'Invalid funding goal' }, { status: 400 })
    }

    const event = await updateSponsorEventFields(id, {
      name,
      location,
      organiser: body.organiser?.trim() || name,
      eventDate: body.eventDate?.trim() || null,
      fundingGoalCusd,
      recipientAddress: cryptoRecipientFromMethods(paymentMethods, body.recipientAddress || wallet),
      whyFunding,
      communitySize: body.communitySize,
      eventFrequency: body.eventFrequency,
      impactSummary: body.impactSummary,
      socialLinks: body.socialLinks,
      impactPortfolioUrl: body.impactPortfolioUrl,
      paymentMethods,
    })
    return NextResponse.json({ success: true, event })
  } catch (e) {
    logApiError('sponsor/events/[id] PATCH', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Failed to update event') }, { status: 500 })
  }
}
