import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'viem'
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

    if (status === 'PENDING') {
      if (!reviewer || !isAddress(reviewer)) {
        return NextResponse.json({ error: 'reviewer address required for pending list' }, { status: 400 })
      }
      const canReview = await canReviewHypercertOnChain(reviewer)
      if (!canReview) {
        return NextResponse.json({ error: 'Not authorized to list pending challenges' }, { status: 403 })
      }
      const challenges = await listTrashAthleteByStatus('PENDING')
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

    return NextResponse.json({ error: 'Provide status=PENDING&reviewer=, mine=1, or wallet=' }, { status: 400 })
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
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Sign in with email to submit the Trash Athlete Challenge' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const username = String(body?.username ?? '').trim()
    const socialProfileUrl = String(body?.socialProfileUrl ?? body?.social_profile_url ?? '').trim()
    const notes = String(body?.notes ?? '').trim()

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

    // Identity comes from the session — never require the client-reported address to match
    // (EOA vs smart account, or stale local ciphertext after a support reset).
    const wallet = await findWalletMetadata(userId)
    if (!wallet) {
      return NextResponse.json(
        { error: 'Finish setting up your embedded wallet before submitting the challenge' },
        { status: 400 }
      )
    }

    const limited = await enforceApiRateLimit({
      request,
      scope: 'trash-athlete-submit',
      maxRequests: 8,
      windowMs: 60_000,
      walletAddress: wallet.smartAccountAddress,
    })
    if (!limited.ok) return limited.response

    if (await hasOpenTrashAthleteForWallet(wallet.smartAccountAddress)) {
      return NextResponse.json(
        { error: 'You already have a pending Trash Athlete Challenge. Wait for verification.' },
        { status: 409 }
      )
    }
    if (await hasOpenTrashAthleteForWallet(wallet.address)) {
      return NextResponse.json(
        { error: 'You already have a pending Trash Athlete Challenge. Wait for verification.' },
        { status: 409 }
      )
    }

    const challenge = await insertTrashAthleteChallenge({
      userId,
      walletAddress: wallet.smartAccountAddress,
      email: session.user?.email ?? null,
      username,
      socialProfileUrl,
      notes: notes || null,
    })

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
