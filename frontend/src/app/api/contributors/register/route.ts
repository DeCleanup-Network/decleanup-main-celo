import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { registerCleanupContributors } from '@/lib/server/contributors/welcome'
import { apiErrorMessage, logApiError } from '@/lib/server/api-error'
import { findWalletMetadata } from '@/lib/wallet/repository'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Register contributor identifiers for a submission (matched after verify). */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    }

    const body = (await request.json()) as {
      submissionId?: string
      contributors?: string[]
      submitterWallet?: string
    }

    const submissionId = body.submissionId?.trim()
    if (!submissionId) {
      return NextResponse.json({ error: 'Missing submissionId' }, { status: 400 })
    }

    const contributors = Array.isArray(body.contributors)
      ? body.contributors.filter((c) => typeof c === 'string' && c.trim())
      : []
    if (contributors.length === 0) {
      return NextResponse.json({ success: true, registered: 0 })
    }

    let submitterWallet = body.submitterWallet?.trim()
    if (!submitterWallet) {
      const meta = await findWalletMetadata(userId)
      submitterWallet = meta?.address || meta?.smartAccountAddress || undefined
    }

    const registered = await registerCleanupContributors({
      submissionId,
      contributors,
      submitterWallet,
    })

    return NextResponse.json({ success: true, registered })
  } catch (e) {
    logApiError('contributors/register', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Register failed') }, { status: 500 })
  }
}
