import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSessionUserId } from '@/lib/auth/require-session'
import {
  deleteAllPasskeysForUser,
  deletePasskeyCredential,
} from '@/lib/passkey/repository'
import { deletePasskeyUnlockSecret } from '@/lib/passkey/unlock-secret'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  credentialId: z.string().optional(),
  removeAll: z.boolean().optional(),
})

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId()
    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    if (parsed.data.removeAll) {
      await deleteAllPasskeysForUser(userId)
      await deletePasskeyUnlockSecret(userId)
      return NextResponse.json({ ok: true, removedAll: true })
    }

    if (parsed.data.credentialId) {
      await deletePasskeyCredential(userId, parsed.data.credentialId)
      const remaining = await import('@/lib/passkey/repository').then((m) =>
        m.countPasskeyCredentials(userId)
      )
      if (remaining === 0) {
        await deletePasskeyUnlockSecret(userId)
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'credentialId or removeAll required' }, { status: 400 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to remove passkey'
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
