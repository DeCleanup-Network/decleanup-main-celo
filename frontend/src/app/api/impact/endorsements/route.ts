import { NextRequest, NextResponse } from 'next/server'
import { getAddress, verifyMessage, type Address } from 'viem'
import {
  buildEndorsementSignMessage,
  isValidEndorsementAddress,
  sanitizeEndorsementInput,
} from '@/lib/impact/portfolio-endorsements'
import {
  insertPortfolioEndorsement,
  listPortfolioEndorsements,
} from '@/lib/supabase/impact-portfolio-endorsements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get('address')?.trim()
    if (!address || !isValidEndorsementAddress(address)) {
      return NextResponse.json({ error: 'Invalid or missing address' }, { status: 400 })
    }
    const endorsements = await listPortfolioEndorsements(address)
    return NextResponse.json({ success: true, endorsements })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch endorsements'
    if (msg.includes('impact_portfolio_endorsements')) {
      return NextResponse.json({ success: true, endorsements: [], warning: 'endorsements table not found' })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

type PostBody = {
  portfolioAddress: string
  endorserAddress: string
  endorserName: string
  endorserOrg: string
  statement: string
  timestamp: number
  signature: `0x${string}`
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PostBody
    const portfolioAddress = body?.portfolioAddress?.trim()
    const endorserAddress = body?.endorserAddress?.trim()
    if (!portfolioAddress || !isValidEndorsementAddress(portfolioAddress)) {
      return NextResponse.json({ error: 'Invalid portfolio address' }, { status: 400 })
    }
    if (!endorserAddress || !isValidEndorsementAddress(endorserAddress)) {
      return NextResponse.json({ error: 'Invalid endorser address' }, { status: 400 })
    }
    if (!body?.signature || !body?.timestamp) {
      return NextResponse.json({ error: 'Missing signature payload' }, { status: 400 })
    }

    const now = Date.now()
    if (Math.abs(now - body.timestamp) > 15 * 60 * 1000) {
      return NextResponse.json({ error: 'Signature timestamp expired' }, { status: 400 })
    }

    const fields = sanitizeEndorsementInput(body)
    if (!fields.statement) {
      return NextResponse.json({ error: 'Endorsement statement is required' }, { status: 400 })
    }

    const message = buildEndorsementSignMessage({
      portfolioAddress: portfolioAddress as Address,
      endorserAddress: endorserAddress as Address,
      ...fields,
      timestamp: body.timestamp,
    })

    const signer = getAddress(endorserAddress) as Address
    const valid = await verifyMessage({
      address: signer,
      message,
      signature: body.signature,
    })
    if (!valid) {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 403 })
    }

    const endorsement = await insertPortfolioEndorsement({
      portfolioAddress,
      endorserAddress: signer,
      ...fields,
      signature: body.signature,
    })

    return NextResponse.json({ success: true, endorsement })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to save endorsement'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
