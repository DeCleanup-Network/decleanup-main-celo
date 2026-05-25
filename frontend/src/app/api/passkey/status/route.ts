import { NextResponse } from 'next/server'
import { requireSessionUserId } from '@/lib/auth/require-session'
import { countPasskeyCredentials, listPasskeyCredentials } from '@/lib/passkey/repository'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await requireSessionUserId()
    const count = await countPasskeyCredentials(userId)
    const credentials = count > 0 ? await listPasskeyCredentials(userId) : []
    return NextResponse.json({
      ok: true,
      hasPasskey: count > 0,
      count,
      credentials,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load passkey status'
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
