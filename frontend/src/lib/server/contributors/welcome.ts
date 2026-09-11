import 'server-only'
import { prisma } from '@/lib/db/prisma'
import {
  parseContributorIdentifier,
  resolveEnsToAddress,
} from './parse-identifier'
import { resolveUserIdByEmail, resolveUserIdByWallet } from '@/lib/server/notifications/resolve-user'
import { createNotification } from '@/lib/server/notifications/service'

const WELCOME_DCU = 10

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

    const existing = await prisma.contributorWelcomeGrant.findUnique({
      where: {
        contributorUserId_submissionId: {
          contributorUserId: userId,
          submissionId: params.submissionId,
        },
      },
    })
    if (existing) continue

    await prisma.contributorWelcomeGrant.create({
      data: {
        contributorUserId: userId,
        submissionId: params.submissionId,
        amountDcu: WELCOME_DCU,
        status: 'pending_ops',
      },
    })

    await createNotification({
      userId,
      type: 'contributor_welcome',
      title: 'Thanks for helping on a cleanup',
      body: `You were credited ${WELCOME_DCU} DCU for being listed as a contributor. Submit your own photos from that day to grow further.`,
      href: '/cleanup',
      meta: { submissionId: params.submissionId, amountDcu: WELCOME_DCU },
    })

    granted += 1
  }

  return { granted }
}
