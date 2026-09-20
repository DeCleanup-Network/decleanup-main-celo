import { NextRequest, NextResponse } from 'next/server'
import { getAddress, isAddress, type Address } from 'viem'
import {
  createSponsorEvent,
  isSponsorshipDbConfigured,
  listPendingSponsorEvents,
  listSponsorEvents,
} from '@/lib/supabase/sponsorship-events'
import { getMaxImpactProductLevel } from '@/lib/sponsor/impact-product-level'
import { SPONSOR_CONFIG } from '@/config/sponsor'
import { canReviewHypercertOnChain } from '@/lib/verifier/hypercert-review-auth'
import type { SponsorEventStatus } from '@/lib/sponsor/types'
import {
  cryptoRecipientFromMethods,
  parsePaymentMethods,
  validatePaymentMethods,
} from '@/lib/sponsor/payment-methods'
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
      const wallet = request.headers.get('x-sponsor-reviewer-wallet') || request.headers.get('x-sponsor-admin-wallet')
      if (!wallet || !isAddress(wallet) || !(await canReviewHypercertOnChain(wallet))) {
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
  eventDate?: string | null
  fundingGoalCusd?: number | string
  recipientAddress?: string
  whyFunding?: string
  communitySize?: string
  eventFrequency?: string
  impactSummary?: string
  socialLinks?: string
  impactPortfolioUrl?: string
  verifiedCleanupsCount?: number
  walletAddress?: string
  onchainOwner?: string
  asProposal?: boolean
  status?: SponsorEventStatus
  paymentMethods?: unknown
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
    const organiser = body.organiser?.trim() || name
    const eventDate = body.eventDate?.trim() || null
    const recipientAddress = body.recipientAddress?.trim() || ''
    const fundingGoalCusd =
      typeof body.fundingGoalCusd === 'number' ? body.fundingGoalCusd : Number(body.fundingGoalCusd)
    const walletAddress = body.walletAddress?.trim() || null
    const whyFunding = body.whyFunding?.trim() || ''
    const communitySize = body.communitySize?.trim() || ''
    const eventFrequency = body.eventFrequency?.trim() || ''
    const impactSummary = body.impactSummary?.trim() || ''
    const socialLinks = body.socialLinks?.trim() || ''

    const paymentMethods = parsePaymentMethods(body.paymentMethods)
    const resolvedRecipient = cryptoRecipientFromMethods(paymentMethods, recipientAddress || walletAddress)

    if (!name || !location || !whyFunding) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (whyFunding.length > SPONSOR_CONFIG.whyFundingMaxChars) {
      return NextResponse.json(
        { error: `Why you need funding must be ${SPONSOR_CONFIG.whyFundingMaxChars} characters or fewer.` },
        { status: 400 }
      )
    }
    const paymentError = validatePaymentMethods(paymentMethods)
    if (paymentError) {
      return NextResponse.json({ error: paymentError }, { status: 400 })
    }
    if (!(fundingGoalCusd > 0) || !Number.isFinite(fundingGoalCusd)) {
      return NextResponse.json({ error: 'Invalid funding goal' }, { status: 400 })
    }
    if (!walletAddress || !isAddress(walletAddress)) {
      return NextResponse.json({ error: 'Connect a wallet to submit for donations.' }, { status: 400 })
    }

    // Community applications always land as pending for verifier review.
    const linked =
      body.onchainOwner && isAddress(body.onchainOwner) ? (getAddress(body.onchainOwner) as Address) : null
    const level = await getMaxImpactProductLevel(getAddress(walletAddress) as Address, linked)
    const minLevel = SPONSOR_CONFIG.minLevelToPropose
    if (level < minLevel) {
      return NextResponse.json(
        {
          error: `Reach Impact Product level ${minLevel} to submit for donations (you are level ${level}).`,
          level,
          minLevel,
        },
        { status: 403 }
      )
    }

    const portfolio =
      body.impactPortfolioUrl?.trim() ||
      `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://dapp.decleanup.net'}/impact/${getAddress(walletAddress)}`

    const event = await createSponsorEvent({
      name,
      location,
      organiser,
      eventDate,
      fundingGoalCusd,
      recipientAddress: resolvedRecipient || undefined,
      paymentMethods,
      verifiedCleanupsCount: body.verifiedCleanupsCount,
      status: 'pending',
      submittedBy: getAddress(walletAddress),
      whyFunding,
      communitySize,
      eventFrequency,
      impactSummary,
      socialLinks,
      impactPortfolioUrl: portfolio,
    })

    return NextResponse.json({ success: true, event }, { status: 201 })
  } catch (e) {
    logApiError('sponsor/events POST', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Failed to create event') }, { status: 500 })
  }
}
