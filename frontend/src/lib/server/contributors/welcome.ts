import 'server-only'
import { prisma } from '@/lib/db/prisma'
import {
  parseContributorIdentifier,
  resolveEnsToAddress,
} from './parse-identifier'
import { resolveUserIdByEmail, resolveUserIdByWallet } from '@/lib/server/notifications/resolve-user'
import { createNotification } from '@/lib/server/notifications/service'
import { findWalletByUserId } from '@/lib/wallet/repository'

const WELCOME_DCU = 10
const LATE_MATCH_SUBMISSION_CAP = 40

export type ContributorMeStats = {
  mentionCount: number
  grantedDcu: number
  newlyGranted: number
}

export async function registerCleanupContributors(params: {
  submissionId: string
  contributors: string[]
  submitterWallet?: string
}): Promise<number> {
  const submitterNorm = params.submitterWallet?.trim().toLowerCase() || ''
  let count = 0
  for (const raw of params.contributors) {
    const parsed = parseContributorIdentifier(raw)
    if (!parsed) continue
    if (submitterNorm && parsed.kind === 'address' && parsed.normalized === submitterNorm) {
      continue
    }
    try {
      await prisma.cleanupContributorEntry.upsert({
        where: {
          submissionId_normalized: {
            submissionId: params.submissionId,
            normalized: parsed.normalized,
          },
        },
        create: {
          submissionId: params.submissionId,
          identifier: parsed.identifier,
          normalized: parsed.normalized,
          kind: parsed.kind,
        },
        update: {
          identifier: parsed.identifier,
          kind: parsed.kind,
        },
      })
      count += 1
    } catch (e) {
      console.warn('[contributors] register entry failed', e)
    }
  }
  return count
}

async function matchEntryToUserId(entry: {
  kind: string
  normalized: string
}): Promise<string | null> {
  if (entry.kind === 'email') {
    return resolveUserIdByEmail(entry.normalized)
  }
  if (entry.kind === 'address') {
    return resolveUserIdByWallet(entry.normalized)
  }
  if (entry.kind === 'ens') {
    const addr = await resolveEnsToAddress(entry.normalized)
    if (!addr) return null
    return resolveUserIdByWallet(addr)
  }
  return null
}

/**
 * After cleanup verified: match registered contributors, grant 10 DCU once, notify.
 */
export async function processContributorWelcomeOnVerify(params: {
  submissionId: string
  submitterWallet?: string
}): Promise<{ granted: number }> {
  const entries = await prisma.cleanupContributorEntry.findMany({
    where: { submissionId: params.submissionId },
  })
  if (entries.length === 0) return { granted: 0 }

  let submitterUserId: string | null = null
  if (params.submitterWallet) {
    submitterUserId = await resolveUserIdByWallet(params.submitterWallet)
  }

  let granted = 0
  for (const entry of entries) {
    const userId = await matchEntryToUserId(entry)
    if (!userId) continue
    if (submitterUserId && userId === submitterUserId) continue

    const ok = await grantWelcomeIfNeeded({
      userId,
      submissionId: params.submissionId,
      submitterUserId,
    })
    if (ok) granted += 1
  }

  return { granted }
}

function isWalletLocalEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.toLowerCase().endsWith('@wallet.local'))
}

/** Email, signer, and smart-account keys that can appear on someone else's cleanup. */
export async function collectUserContributorKeys(
  userId: string,
  extraWallets: string[] = []
): Promise<string[]> {
  const keys = new Set<string>()
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })
  if (user?.email && !isWalletLocalEmail(user.email)) {
    keys.add(user.email.trim().toLowerCase())
  }

  const wallet = await findWalletByUserId(userId)
  if (wallet?.address) keys.add(wallet.address.toLowerCase())
  if (wallet?.smartAccountAddress) keys.add(wallet.smartAccountAddress.toLowerCase())

  const accounts = await prisma.account.findMany({
    where: { userId, provider: 'wallet' },
    select: { providerAccountId: true },
  })
  for (const row of accounts) {
    const id = row.providerAccountId?.trim().toLowerCase()
    if (id) keys.add(id)
  }

  for (const raw of extraWallets) {
    const s = raw.trim().toLowerCase()
    if (s.startsWith('0x') && s.length === 42) keys.add(s)
  }

  return [...keys]
}

async function grantWelcomeIfNeeded(params: {
  userId: string
  submissionId: string
  submitterUserId: string | null
}): Promise<boolean> {
  if (params.submitterUserId && params.userId === params.submitterUserId) return false

  const existing = await prisma.contributorWelcomeGrant.findUnique({
    where: {
      contributorUserId_submissionId: {
        contributorUserId: params.userId,
        submissionId: params.submissionId,
      },
    },
  })
  if (existing) return false

  try {
    await prisma.contributorWelcomeGrant.create({
      data: {
        contributorUserId: params.userId,
        submissionId: params.submissionId,
        amountDcu: WELCOME_DCU,
        status: 'pending_ops',
      },
    })
  } catch (e: unknown) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: string }).code) : ''
    if (code === 'P2002') return false
    throw e
  }

  await createNotification({
    userId: params.userId,
    type: 'contributor_welcome',
    title: 'Thanks for helping on a cleanup',
    body: `You were credited ${WELCOME_DCU} DCU for being listed as a contributor. Submit your own photos from that day to grow further.`,
    href: '/cleanup',
    meta: { submissionId: params.submissionId, amountDcu: WELCOME_DCU },
  })

  return true
}

/**
 * When someone listed by email or an older wallet later signs in (or connects a smart account),
 * credit the 10 DCU welcome that was skipped at verify time.
 */
export async function processPendingContributorWelcomeForUser(params: {
  userId: string
  extraWallets?: string[]
}): Promise<{ granted: number; mentionCount: number; grantedDcu: number }> {
  const keys = await collectUserContributorKeys(params.userId, params.extraWallets)
  if (keys.length === 0) {
    return { granted: 0, mentionCount: 0, grantedDcu: 0 }
  }

  const entries = await prisma.cleanupContributorEntry.findMany({
    where: { normalized: { in: keys } },
    select: { submissionId: true, kind: true, normalized: true },
  })
  const submissionIds = [...new Set(entries.map((e) => e.submissionId))]
  const mentionCount = submissionIds.length

  const grants = await prisma.contributorWelcomeGrant.findMany({
    where: { contributorUserId: params.userId },
    select: { submissionId: true, amountDcu: true },
  })
  const grantedIds = new Set(grants.map((g) => g.submissionId))
  let grantedDcu = grants.reduce((sum, g) => sum + (g.amountDcu || WELCOME_DCU), 0)

  const pendingIds = submissionIds.filter((id) => !grantedIds.has(id)).slice(0, LATE_MATCH_SUBMISSION_CAP)
  if (pendingIds.length === 0) {
    return { granted: 0, mentionCount, grantedDcu }
  }

  const { getCleanupDetailsFresh } = await import('@/lib/blockchain/contracts')
  let newlyGranted = 0
  for (const submissionId of pendingIds) {
    let verified = false
    let submitterWallet: string | undefined
    try {
      const details = await getCleanupDetailsFresh(BigInt(submissionId))
      verified = Boolean(details?.verified)
      submitterWallet = details?.user
    } catch (e) {
      console.warn('[contributors] late-match cleanup read failed', submissionId, e)
      continue
    }
    if (!verified) continue

    let submitterUserId: string | null = null
    if (submitterWallet) {
      submitterUserId = await resolveUserIdByWallet(submitterWallet)
    }
    const ok = await grantWelcomeIfNeeded({
      userId: params.userId,
      submissionId,
      submitterUserId,
    })
    if (ok) {
      newlyGranted += 1
      grantedDcu += WELCOME_DCU
    }
  }

  return { granted: newlyGranted, mentionCount, grantedDcu }
}

export async function getContributorMeStats(params: {
  userId: string
  extraWallets?: string[]
}): Promise<ContributorMeStats> {
  const result = await processPendingContributorWelcomeForUser(params)
  return {
    mentionCount: result.mentionCount,
    grantedDcu: result.grantedDcu,
    newlyGranted: result.granted,
  }
}
