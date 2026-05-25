import { NextResponse } from 'next/server'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import type { AuthenticationResponseJSON } from '@simplewebauthn/server'
import { requireSessionUserId } from '@/lib/auth/require-session'
import { consumeWebAuthnChallenge } from '@/lib/passkey/challenge-store'
import {
  findPasskeyByCredentialId,
  toWebAuthnCredential,
  updatePasskeyCounter,
} from '@/lib/passkey/repository'
import { getPasskeyUnlockSecret } from '@/lib/passkey/unlock-secret'
import { getWebAuthnOrigins, getWebAuthnRpId } from '@/lib/passkey/config'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId()
    const body = (await request.json()) as { response?: AuthenticationResponseJSON }
    if (!body.response) {
      return NextResponse.json({ error: 'Missing authentication response' }, { status: 400 })
    }

    const credentialId = body.response.id
    const stored = await findPasskeyByCredentialId(credentialId)
    if (!stored || stored.userId !== userId) {
      return NextResponse.json({ error: 'Unknown passkey credential' }, { status: 400 })
    }

    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: async (challenge) =>
        consumeWebAuthnChallenge(userId, challenge, 'authentication'),
      expectedOrigin: getWebAuthnOrigins(),
      expectedRPID: getWebAuthnRpId(),
      credential: toWebAuthnCredential(stored),
      requireUserVerification: true,
    })

    if (!verification.verified) {
      return NextResponse.json({ error: 'Passkey authentication failed' }, { status: 401 })
    }

    await updatePasskeyCounter(credentialId, verification.authenticationInfo.newCounter)

    const unlockKey = await getPasskeyUnlockSecret(userId)
    if (!unlockKey) {
      return NextResponse.json({ error: 'Passkey unlock not configured' }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      unlockKey,
      expiresIn: 60,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Authentication verification failed'
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[passkey/auth/verify]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
