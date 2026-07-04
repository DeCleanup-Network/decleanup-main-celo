import { NextResponse } from 'next/server'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { requireSessionUserId } from '@/lib/auth/require-session'
import { createWebAuthnChallenge } from '@/lib/passkey/challenge-store'
import { getWebAuthnRpId } from '@/lib/passkey/config'
import { prisma } from '@/lib/db/prisma'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const userId = await requireSessionUserId()
    const credentials = await prisma.passkeyCredential.findMany({ where: { userId } })

    if (credentials.length === 0) {
      return NextResponse.json({ error: 'No passkeys registered' }, { status: 404 })
    }

    // Prefer on-device Face ID / Touch ID — hybrid transport opens QR / cross-device on iOS Safari.
    const options = await generateAuthenticationOptions({
      rpID: getWebAuthnRpId(),
      allowCredentials: credentials.map((c) => ({
        id: c.credentialID,
        transports: ['internal'],
      })),
      userVerification: 'required',
    })

    await createWebAuthnChallenge(userId, options.challenge, 'authentication')

    return NextResponse.json({ ok: true, options })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create authentication options'
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[passkey/auth/options]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
