import { NextResponse } from 'next/server'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import type { RegistrationResponseJSON } from '@simplewebauthn/server'
import { requireSessionUserId } from '@/lib/auth/require-session'
import { consumeWebAuthnChallenge } from '@/lib/passkey/challenge-store'
import { savePasskeyCredential } from '@/lib/passkey/repository'
import { getOrCreatePasskeyUnlockSecret } from '@/lib/passkey/unlock-secret'
import { getWebAuthnOrigins, getWebAuthnRpId } from '@/lib/passkey/config'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId()
    const body = (await request.json()) as { response?: RegistrationResponseJSON }
    if (!body.response) {
      return NextResponse.json({ error: 'Missing registration response' }, { status: 400 })
    }

    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: async (challenge) =>
        consumeWebAuthnChallenge(userId, challenge, 'registration'),
      expectedOrigin: getWebAuthnOrigins(),
      expectedRPID: getWebAuthnRpId(),
      requireUserVerification: true,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Passkey registration verification failed' }, { status: 400 })
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo

    await savePasskeyCredential({
      userId,
      credential,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    })

    const unlockKey = await getOrCreatePasskeyUnlockSecret(userId)

    return NextResponse.json({
      ok: true,
      unlockKey,
      credentialId: credential.id,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Registration verification failed'
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[passkey/register/verify]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
