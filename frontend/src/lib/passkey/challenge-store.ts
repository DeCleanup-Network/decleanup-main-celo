import 'server-only'
import { prisma } from '@/lib/db/prisma'

const CHALLENGE_TTL_MS = 5 * 60 * 1000

export type WebAuthnChallengeType = 'registration' | 'authentication'

export async function createWebAuthnChallenge(
  userId: string,
  challenge: string,
  type: WebAuthnChallengeType
): Promise<void> {
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS)
  await prisma.webAuthnChallenge.create({
    data: { userId, challenge, type, expiresAt },
  })
}

export async function consumeWebAuthnChallenge(
  userId: string,
  challenge: string,
  type: WebAuthnChallengeType
): Promise<boolean> {
  const row = await prisma.webAuthnChallenge.findFirst({
    where: {
      userId,
      challenge,
      type,
      expiresAt: { gt: new Date() },
    },
  })
  if (!row) return false
  await prisma.webAuthnChallenge.delete({ where: { id: row.id } })
  return true
}

/** Remove expired challenges (best-effort housekeeping). */
export async function purgeExpiredChallenges(): Promise<void> {
  await prisma.webAuthnChallenge.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
}
