import { NextRequest, NextResponse } from 'next/server'
import { resolveWalletIdentity } from '@/lib/wallet/resolve-identity'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')?.trim()
  if (!address) {
    return NextResponse.json({ error: 'Missing address' }, { status: 400 })
  }

  try {
    const identity = await resolveWalletIdentity(address)
    if (!identity) {
      return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      eoaAddress: identity.eoaAddress,
      smartAccountAddress: identity.smartAccountAddress,
      publicAddress: identity.publicAddress,
      redirectToPublicAddress: identity.redirectToPublicAddress,
    })
  } catch (e) {
    console.error('[GET /api/wallet/resolve-identity]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to resolve wallet identity' },
      { status: 500 }
    )
  }
}
