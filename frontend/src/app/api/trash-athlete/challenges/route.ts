import { NextRequest, NextResponse } from 'next/server'
import { isAddress, verifyMessage, type Address } from 'viem'
import { auth } from '@/auth'
import { findWalletMetadata } from '@/lib/wallet/repository'
import {
  hasOpenTrashAthleteForWallet,
  insertTrashAthleteChallenge,
  listTrashAthleteByStatus,
  listTrashAthleteForUserId,
  listTrashAthleteForWallet,
} from '@/lib/supabase/trash-athlete-db'
import { canReviewHypercertOnChain } from '@/lib/verifier/hypercert-review-auth'
import { enforceApiRateLimit } from '@/lib/server/rate-limit'
import { apiErrorMessage, logApiError } from '@/lib/server/api-error'
import { isTelegramNotifierConfigured } from '@/lib/server/telegram-config'
import { notifyVerifiersOfTrashAthleteChallenge } from '@/lib/server/telegram-trash-athlete-notify'
import {
  assertFreshTimestamp,
  buildTrashAthleteSubmitMessage,
} from '@/lib/trash-athlete/review-signing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const URL_RE = /^https?:\/\/.{3,2000}$/i

function isMissingTableError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.includes('Could not find the table') && msg.includes('trash_athlete')
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const mine = searchParams.get('mine') === '1'
    const wallet = (searchParams.get('wallet') || '').trim()
    const reviewer = (searchParams.get('reviewer') || '').trim()

    if (status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED') {
      if (!reviewer || !isAddress(reviewer)) {
        return NextResponse.json(
          { error: 'reviewer address required for verifier challenge lists' },
          { status: 400 }
        )
      }
      const canReview = await canReviewHypercertOnChain(reviewer)
      if (!canReview) {
        return NextResponse.json({ error: 'Not authorized to list challenges' }, { status: 403 })
      }
      const challenges = await listTrashAthleteByStatus(status)
      return NextResponse.json({ success: true, challenges })
    }

    if (mine) {
      const session = await auth()
      const userId = session?.user?.id
      if (!userId) {
        return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
      }
      const challenges = await listTrashAthleteForUserId(userId)
      return NextResponse.json({ success: true, challenges })
    }

    if (wallet) {
      if (!isAddress(wallet)) {
        return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
      }
      const challenges = await listTrashAthleteForWallet(wallet)
      return NextResponse.json({ success: true, challenges })
    }

    return NextResponse.json(
      { error: 'Provide status=PENDING|APPROVED|REJECTED&reviewer=, mine=1, or wallet=' },
      { status: 400 }
    )
  } catch (e) {
    if (isMissingTableError(e)) {
      return NextResponse.json(
        { error: 'Trash athlete table not migrated yet. Run supabase migration 20260830_create_trash_athlete_challenges.sql' },
        { status: 503 }
      )
    }
    logApiError('trash-athlete/challenges GET', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Failed to list challenges') }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id ?? null
    const body = await request.json().catch(() => ({}))
    const username = String(body?.username ?? '').trim()
    const socialProfileUrl = String(body?.socialProfileUrl ?? body?.social_profile_url ?? '').trim()
    const notes = String(body?.notes ?? '').trim()
    const walletFromBody = String(body?.wallet ?? body?.walletAddress ?? '').trim()
    const signature = body?.signature as `0x${string}` | undefined
    const timestamp = Number(body?.timestamp)

    if (!username || username.length < 2 || username.length > 64) {
      return NextResponse.json({ error: 'Username must be 2–64 characters' }, { status: 400 })
    }
    if (!URL_RE.test(socialProfileUrl)) {
      return NextResponse.json(
        { error: 'Social profile link must be a valid http(s) URL (post or profile with your cleanup photos)' },
        { status: 400 }
      )
    }
    if (notes.length > 2000) {
      return NextResponse.json({ error: 'Notes too long (max 2000 characters)' }, { status: 400 })
    }

    /** Signer EOA — MetaMask / import address; Trash Athlete history + rewards key off this. */
    let rewardWallet: Address
    let email: string | null = session?.user?.email ?? null
    let submitUserId: string | null = userId

    if (userId) {
      // Email / embedded account path — store signer EOA (not smart account)
      const wallet = await findWalletMetadata(userId)
      if (!wallet) {
        return NextResponse.json(
          { error: 'Finish setting up your embedded wallet before submitting the challenge' },
          { status: 400 }
        )
      }
      rewardWallet = wallet.address as Address

      // Block duplicate pending on signer or legacy smart-account rows
      if (await hasOpenTrashAthleteForWallet(wallet.address)) {
        return NextResponse.json(
          { error: 'You already have a pending Trash Athlete Challenge. Wait for verification.' },
          { status: 409 }
        )
      }
      if (
        wallet.smartAccountAddress &&
        (await hasOpenTrashAthleteForWallet(wallet.smartAccountAddress))
      ) {
        return NextResponse.json(
          { error: 'You already have a pending Trash Athlete Challenge. Wait for verification.' },
          { status: 409 }
        )
      }
    } else {
      // WalletConnect / external wallet: prove ownership with a signed message
      if (!walletFromBody || !isAddress(walletFromBody)) {
        return NextResponse.json(
          { error: 'Connect a wallet or sign in with email to submit' },
          { status: 401 }
        )
      }
      if (!signature || !Number.isFinite(timestamp)) {
        return NextResponse.json(
          { error: 'Wallet signature required. Confirm the sign request in your wallet.' },
          { status: 400 }
        )
      }
      try {
        assertFreshTimestamp(timestamp, 'Submit signature')
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'Signature expired' },
          { status: 400 }
        )
      }

      const message = buildTrashAthleteSubmitMessage({
        username,
        socialProfileUrl,
        notes,
        wallet: walletFromBody as Address,
        timestamp,
      })
      const valid = await verifyMessage({
        address: walletFromBody as Address,
        message,
        signature,
      })
      if (!valid) {
        return NextResponse.json({ error: 'Wallet signature verification failed' }, { status: 403 })
      }

      rewardWallet = walletFromBody.toLowerCase() as Address
      submitUserId = null
      email = null

      if (await hasOpenTrashAthleteForWallet(rewardWallet)) {
        return NextResponse.json(
          { error: 'You already have a pending Trash Athlete Challenge. Wait for verification.' },
          { status: 409 }
        )
      }
    }

    const limited = await enforceApiRateLimit({
      request,
      scope: 'trash-athlete-submit',
      maxRequests: 8,
      windowMs: 60_000,
      walletAddress: rewardWallet,
    })
    if (!limited.ok) return limited.response

    const challenge = await insertTrashAthleteChallenge({
      userId: submitUserId,
      walletAddress: rewardWallet,
      email,
      username,
      socialProfileUrl,
      notes: notes || null,
    })

    if (isTelegramNotifierConfigured()) {
      try {
        const notify = await notifyVerifiersOfTrashAthleteChallenge(challenge)
        if (!notify.sent) {
          console.warn(
            '[trash-athlete/challenges] telegram notify skipped:',
            notify.reason,
            notify.detail ?? ''
          )
        }
      } catch (err) {
        console.warn('[trash-athlete/challenges] telegram notify failed (non-fatal):', err)
      }
    }

    return NextResponse.json({ success: true, challenge })
  } catch (e) {
    if (isMissingTableError(e)) {
      return NextResponse.json(
        { error: 'Trash athlete table not migrated yet. Run supabase migration 20260830_create_trash_athlete_challenges.sql' },
        { status: 503 }
      )
    }
    logApiError('trash-athlete/challenges POST', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Failed to submit challenge') }, { status: 500 })
  }
}
