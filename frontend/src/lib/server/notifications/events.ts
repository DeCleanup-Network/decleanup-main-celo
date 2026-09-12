import 'server-only'
import { createNotification } from './service'
import { resolveUserIdByWallet } from './resolve-user'
import type { NotificationType } from './types'
import {
  TRASH_ATHLETE_BONUS_CDCU,
  TRASH_ATHLETE_DCU_POINTS,
  TRASH_ATHLETE_LEVEL_COPY,
} from '@/lib/trash-athlete/constants'

/** Notify a registered user by wallet (EOA or smart account). No-op if unmatched. */
export async function notifyWallet(
  wallet: string,
  payload: {
    type: NotificationType | string
    title: string
    body: string
    href?: string
    meta?: Record<string, unknown>
  }
) {
  const userId = await resolveUserIdByWallet(wallet)
  if (!userId) return null
  return createNotification({ userId, ...payload })
}

export async function notifyCleanupVerified(wallet: string, submissionId: string) {
  return notifyWallet(wallet, {
    type: 'cleanup_verified',
    title: 'Cleanup verified',
    body: `Your cleanup #${submissionId} was verified. Claim your Impact Product level when ready.`,
    href: '/',
    meta: { submissionId },
  })
}

export async function notifyCleanupDeclined(wallet: string, submissionId: string) {
  return notifyWallet(wallet, {
    type: 'cleanup_declined',
    title: 'Cleanup declined',
    body: `Your cleanup #${submissionId} was not approved. You can submit again with clearer before/after photos.`,
    href: '/cleanup',
    meta: { submissionId },
  })
}

export async function notifyCleanupSubmitted(userId: string, submissionId: string) {
  return createNotification({
    userId,
    type: 'cleanup_submitted',
    title: 'Cleanup submitted',
    body: `Cleanup #${submissionId} is pending verification.`,
    href: '/',
    meta: { submissionId },
  })
}

export async function notifyLevelClaimed(
  userId: string,
  opts?: {
    level?: number
    nftAction?: 'minted' | 'upgraded' | string
    hasImpactReport?: boolean
    hasRecyclables?: boolean
  }
) {
  const action =
    opts?.nftAction === 'minted' || opts?.nftAction === 'upgraded'
      ? opts.nftAction
      : typeof opts?.level === 'number' && opts.level <= 1
        ? 'minted'
        : 'upgraded'

  const reportParts: string[] = []
  if (opts?.hasRecyclables) reportParts.push('recyclables report')
  if (opts?.hasImpactReport) reportParts.push('impact report')

  let body =
    typeof opts?.level === 'number'
      ? `Your Impact Product was ${action} to level ${opts.level}.`
      : `Your Impact Product was ${action}.`

  if (reportParts.length === 1) {
    body += ` Additional reward will be granted for submitting ${reportParts[0]}.`
  } else if (reportParts.length === 2) {
    body += ` Additional reward will be granted for submitting ${reportParts[0]} and ${reportParts[1]}.`
  }

  return createNotification({
    userId,
    type: 'level_claimed',
    title: action === 'minted' ? 'Impact Product minted' : 'Impact Product upgraded',
    body,
    href: '/',
    meta: {
      ...(opts?.level != null ? { level: opts.level } : {}),
      nftAction: action,
      hasImpactReport: Boolean(opts?.hasImpactReport),
      hasRecyclables: Boolean(opts?.hasRecyclables),
    },
  })
}

export async function notifyTrashAthleteReview(
  wallet: string,
  action: 'approve' | 'reject',
  challengeId: string
) {
  if (action === 'approve') {
    return notifyWallet(wallet, {
      type: 'trash_athlete_verified',
      title: 'Trash Athlete approved',
      body: `Your challenge was approved. Rewards: ${TRASH_ATHLETE_BONUS_CDCU} $cDCU, ${TRASH_ATHLETE_LEVEL_COPY}, and ${TRASH_ATHLETE_DCU_POINTS} DCU (ops will complete mint/upgrade).`,
      href: '/cleanup/trash-athlete',
      meta: { challengeId },
    })
  }
  return notifyWallet(wallet, {
    type: 'trash_athlete_declined',
    title: 'Trash Athlete declined',
    body: 'Your Trash Athlete Challenge was not approved. You can submit again with a stronger entry.',
    href: '/cleanup/trash-athlete',
    meta: { challengeId },
  })
}

export async function notifyTrashAthleteRewards(userId: string, challengeId: string) {
  return createNotification({
    userId,
    type: 'trash_athlete_rewards',
    title: 'Trash Athlete rewards ready',
    body: `Claim your ${TRASH_ATHLETE_BONUS_CDCU} $cDCU bonus, then open the app to ${TRASH_ATHLETE_LEVEL_COPY.toLowerCase()} if you already have an NFT.`,
    href: '/cleanup/trash-athlete',
    meta: { challengeId },
  })
}
