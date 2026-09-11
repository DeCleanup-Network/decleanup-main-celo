import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { auth } from '@/auth'
import { createNotification } from '@/lib/server/notifications/service'
import { resolveUserIdByWallet } from '@/lib/server/notifications/resolve-user'
import {
  notifyCleanupVerified,
  notifyCleanupDeclined,
  notifyCleanupSubmitted,
  notifyLevelClaimed,
} from '@/lib/server/notifications/events'
import { processContributorWelcomeOnVerify } from '@/lib/server/contributors/welcome'
import { canReviewHypercertOnChain } from '@/lib/verifier/hypercert-review-auth'
import { apiErrorMessage, logApiError } from '@/lib/server/api-error'
import { findWalletMetadata } from '@/lib/wallet/repository'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type EventBody = {
  event: string
  walletAddress?: string
  submissionId?: string
  challengeId?: string
  level?: number
  title?: string
  body?: string
  href?: string
  meta?: Record<string, unknown>
  reviewer?: string
}

async function assertVerifierOrSelf(params: {
  sessionUserId: string | undefined
  targetWallet?: string
  reviewer?: string
  allowSelf: boolean
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (params.allowSelf && params.sessionUserId && params.targetWallet) {
    const meta = await findWalletMetadata(params.sessionUserId)
    const eoa = meta?.address?.toLowerCase()
    const sa = meta?.smartAccountAddress?.toLowerCase()
    const w = params.targetWallet.toLowerCase()
    if (eoa === w || sa === w) return { ok: true }
  }

  if (params.reviewer && isAddress(params.reviewer)) {
    const can = await canReviewHypercertOnChain(params.reviewer)
    if (can) return { ok: true }
  }

  // Session user who is a verifier (wallet from their account)
  if (params.sessionUserId) {
    const meta = await findWalletMetadata(params.sessionUserId)
    const addr = meta?.address || meta?.smartAccountAddress
    if (addr && (await canReviewHypercertOnChain(addr))) return { ok: true }
  }

  return { ok: false, status: 403, error: 'Not authorized to emit this event' }
}

/**
 * Client/server event bus → NotificationService.
 * Self events require session; verify/decline require verifier.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const sessionUserId = session?.user?.id
    const body = (await request.json()) as EventBody
    const event = body.event?.trim()
    if (!event) {
      return NextResponse.json({ error: 'Missing event' }, { status: 400 })
    }

    switch (event) {
      case 'cleanup_submitted': {
        if (!sessionUserId) {
          return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
        }
        const submissionId = body.submissionId || 'unknown'
        await notifyCleanupSubmitted(sessionUserId, submissionId)
        return NextResponse.json({ success: true })
      }

      case 'level_claimed': {
        if (!sessionUserId) {
          return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
        }
        await notifyLevelClaimed(sessionUserId, body.level)
        return NextResponse.json({ success: true })
      }

      case 'referral_joined': {
        if (!sessionUserId) {
          return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
        }
        await createNotification({
          userId: sessionUserId,
          type: 'referral_joined',
          title: 'Referral linked',
          body: 'Your referrer is set. Submit a cleanup to activate rewards.',
          href: '/cleanup',
          meta: body.meta,
        })
        return NextResponse.json({ success: true })
      }

      case 'cleanup_verified':
      case 'cleanup_declined': {
        const wallet = body.walletAddress?.trim()
        const submissionId = body.submissionId?.trim()
        if (!wallet || !isAddress(wallet) || !submissionId) {
          return NextResponse.json({ error: 'walletAddress and submissionId required' }, { status: 400 })
        }
        const authz = await assertVerifierOrSelf({
          sessionUserId,
          targetWallet: wallet,
          reviewer: body.reviewer,
          allowSelf: false,
        })
        if (!authz.ok) {
          return NextResponse.json({ error: authz.error }, { status: authz.status })
        }
        if (event === 'cleanup_verified') {
          await notifyCleanupVerified(wallet, submissionId)
          const welcome = await processContributorWelcomeOnVerify({
            submissionId,
            submitterWallet: wallet,
          })
          return NextResponse.json({ success: true, contributorGrants: welcome.granted })
        }
        await notifyCleanupDeclined(wallet, submissionId)
        return NextResponse.json({ success: true })
      }

      case 'custom': {
        if (!sessionUserId) {
          return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
        }
        const target =
          body.walletAddress && isAddress(body.walletAddress)
            ? await resolveUserIdByWallet(body.walletAddress)
            : sessionUserId
        if (!target) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }
        if (target !== sessionUserId) {
          const authz = await assertVerifierOrSelf({
            sessionUserId,
            reviewer: body.reviewer,
            allowSelf: false,
          })
          if (!authz.ok) {
            return NextResponse.json({ error: authz.error }, { status: authz.status })
          }
        }
        await createNotification({
          userId: target,
          type: String(body.meta?.type || 'custom'),
          title: body.title || 'Notification',
          body: body.body || '',
          href: body.href,
          meta: body.meta,
        })
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: `Unknown event: ${event}` }, { status: 400 })
    }
  } catch (e) {
    logApiError('notifications/events', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Emit failed') }, { status: 500 })
  }
}
