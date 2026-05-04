import { NextRequest, NextResponse } from 'next/server'
import { verifyMessage, type Address } from 'viem'
import {
  buildProfileSignMessage,
  isValidPortfolioAddress,
  sanitizeProfileFromUserInput,
  type EditableProfile,
} from '@/lib/impact/portfolio-profile'
import { getImpactPortfolioProfile, upsertImpactPortfolioProfile } from '@/lib/supabase/impact-portfolios'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const addressParam = request.nextUrl.searchParams.get('address')?.trim()
    if (!addressParam || !isValidPortfolioAddress(addressParam)) {
      return NextResponse.json({ error: 'Invalid or missing address' }, { status: 400 })
    }
    const profile = await getImpactPortfolioProfile(addressParam)
    return NextResponse.json({ success: true, profile })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch impact profile'
    if (msg.includes("Could not find the table 'public.impact_portfolios'")) {
      return NextResponse.json({ success: true, profile: null, warning: 'impact_portfolios table not found' })
    }
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    )
  }
}

type SaveBody = {
  address: string
  profile: EditableProfile
  timestamp: number
  signature: `0x${string}`
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SaveBody
    const address = body?.address?.trim()
    if (!address || !isValidPortfolioAddress(address)) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
    }
    if (!body?.signature || !body?.timestamp) {
      return NextResponse.json({ error: 'Missing signature payload' }, { status: 400 })
    }

    const now = Date.now()
    if (Math.abs(now - body.timestamp) > 15 * 60 * 1000) {
      return NextResponse.json({ error: 'Signature timestamp expired' }, { status: 400 })
    }

    const profile = sanitizeProfileFromUserInput(body.profile)
    const message = buildProfileSignMessage({
      address: address as Address,
      profile,
      timestamp: body.timestamp,
    })
    const valid = await verifyMessage({
      address: address as Address,
      message,
      signature: body.signature,
    })
    if (!valid) {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 403 })
    }

    await upsertImpactPortfolioProfile(address, profile)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to save profile' },
      { status: 500 }
    )
  }
}
