import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, defineChain, getAddress, http, verifyMessage, type Address } from 'viem'
import {
  buildProfileSignMessage,
  isValidPortfolioAddress,
  sanitizeProfileFromUserInput,
  type EditableProfile,
} from '@/lib/impact/portfolio-profile'
import { assertSignerMayEditPortfolioProfile } from '@/lib/impact/portfolio-profile-auth'
import {
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
  REQUIRED_RPC_URL,
} from '@/lib/blockchain/chain-constants'
import {
  getImpactPortfolioProfileResolved,
  upsertImpactPortfolioProfile,
} from '@/lib/supabase/impact-portfolios'
import { resolveWalletIdentity } from '@/lib/wallet/resolve-identity'

const requiredChain = defineChain({
  id: REQUIRED_CHAIN_ID,
  name: REQUIRED_CHAIN_NAME,
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: { default: { http: [REQUIRED_RPC_URL] } },
})

function getPortfolioPublicClient() {
  return createPublicClient({
    chain: requiredChain,
    transport: http(REQUIRED_RPC_URL),
  })
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const addressParam = request.nextUrl.searchParams.get('address')?.trim()
    if (!addressParam || !isValidPortfolioAddress(addressParam)) {
      return NextResponse.json({ error: 'Invalid or missing address' }, { status: 400 })
    }
    const identity = await resolveWalletIdentity(addressParam)
    const eoa = identity?.eoaAddress ?? addressParam
    const profile = await getImpactPortfolioProfileResolved(
      eoa,
      identity?.smartAccountAddress
    )
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
  /** When the connected wallet differs from `address` (e.g. Safe signs for an EOA portfolio row). */
  signerAddress?: string
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

    let signer: Address
    try {
      const rawSigner = (body.signerAddress?.trim() || address).trim()
      signer = getAddress(rawSigner) as Address
    } catch {
      return NextResponse.json({ error: 'Invalid signer address' }, { status: 400 })
    }

    const valid = await verifyMessage({
      address: signer,
      message,
      signature: body.signature,
    })
    if (!valid) {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 403 })
    }

    try {
      const publicClient = getPortfolioPublicClient()
      await assertSignerMayEditPortfolioProfile(publicClient, address as Address, signer)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'SIGNER_NOT_AUTHORIZED_FOR_PORTFOLIO') {
        return NextResponse.json(
          {
            error:
              'This wallet is not authorized to update this portfolio address. Connect the portfolio address, its linked smart account, or an owner of that smart account.',
          },
          { status: 403 }
        )
      }
      throw e
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
