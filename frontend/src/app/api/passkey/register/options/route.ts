import { NextResponse } from 'next/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { requireSessionUserId } from '@/lib/auth/require-session'
import { createWebAuthnChallenge } from '@/lib/passkey/challenge-store'
import { listPasskeyCredentials } from '@/lib/passkey/repository'
import { getWebAuthnRpId, getWebAuthnRpName } from '@/lib/passkey/config'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const userId = await requireSessionUserId()
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const existing = await listPasskeyCredentials(userId)
    const options = await generateRegistrationOptions({
      rpName: getWebAuthnRpName(),
      rpID: getWebAuthnRpId(),
      userName: user.email ?? userId,
      userDisplayName: user.name ?? user.email ?? 'DeCleanup user',
      userID: Buffer.from(userId),
      attestationType: 'none',
      excludeCredentials: existing.map((c) => ({
        id: c.credentialID,
        transports: ['internal', 'hybrid'],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
        authenticatorAttachment: 'platform',
      },
    })

    await createWebAuthnChallenge(userId, options.challenge, 'registration')

    return NextResponse.json({ ok: true, options })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create registration options'
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[passkey/register/options]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
