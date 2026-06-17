import { NextRequest, NextResponse } from 'next/server'
import { isAddress, type Address } from 'viem'
import { fetchPortfolioHypercerts } from '@/lib/impact/portfolio-hypercerts.server'
import { resolveWalletIdentity } from '@/lib/wallet/resolve-identity'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get('address')?.trim()
    if (!raw || !isAddress(raw)) {
      return NextResponse.json({ error: 'Invalid or missing address' }, { status: 400 })
    }

    const identity = await resolveWalletIdentity(raw)
    const eoaAddress = (identity?.publicAddress ?? identity?.eoaAddress ?? raw) as Address
    const sa = request.nextUrl.searchParams.get('sa')?.trim()
    const legacySmartAccount =
      sa && isAddress(sa)
        ? (sa as Address)
        : identity?.smartAccountAddress &&
            identity.smartAccountAddress.toLowerCase() !== eoaAddress.toLowerCase()
          ? identity.smartAccountAddress
          : undefined

    const hypercerts = await fetchPortfolioHypercerts(eoaAddress, legacySmartAccount)
    return NextResponse.json(hypercerts)
  } catch (error) {
    console.error('[api/impact/portfolio-hypercerts]', error)
    return NextResponse.json({ error: 'Failed to load hypercerts' }, { status: 500 })
  }
}
