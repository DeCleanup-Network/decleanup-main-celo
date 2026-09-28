import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { auth } from '@/auth'
import { getContributorMeStats } from '@/lib/server/contributors/welcome'
import { resolveUserIdByWallet } from '@/lib/server/notifications/resolve-user'
import { apiErrorMessage, logApiError } from '@/lib/server/api-error'
import { enforceApiRateLimit } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseWallets(raw: string | null): string[] {
  if (!raw) return []
  const out: string[] = []
  for (const part of raw.split(',')) {
    const s = part.trim()
    if (isAddress(s)) out.push(s)
  }
  return out
}

/** Count listed cleanups and credit late-matched 10 DCU welcome grants. */
export async function GET(request: NextRequest) {
  try {
    const extraWallets = parseWallets(request.nextUrl.searchParams.get('wallets'))
    const limited = await enforceApiRateLimit({
      request,
      scope: 'contributors-me',
      maxRequests: 30,
      windowMs: 60_000,
      walletAddress: extraWallets[0] || null,
    })
    if (!limited.ok) return limited.response

    const session = await auth()
    let userId = session?.user?.id || null
    if (!userId) {
      for (const wallet of extraWallets) {
        userId = await resolveUserIdByWallet(wallet)
        if (userId) break
      }
    }
    if (!userId) {
      return NextResponse.json({ mentionCount: 0, grantedDcu: 0, newlyGranted: 0 })
    }

    const stats = await getContributorMeStats({ userId, extraWallets })
    return NextResponse.json(stats)
  } catch (e) {
    logApiError('contributors/me', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Lookup failed') }, { status: 500 })
  }
}
