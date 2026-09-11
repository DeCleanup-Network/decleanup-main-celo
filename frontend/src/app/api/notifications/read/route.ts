import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { markNotificationsRead } from '@/lib/server/notifications/service'
import { apiErrorMessage, logApiError } from '@/lib/server/api-error'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      ids?: string[] | 'all'
      id?: string
    }

    const ids =
      body.ids === 'all'
        ? 'all'
        : Array.isArray(body.ids)
          ? body.ids
          : body.id
            ? [body.id]
            : []

    if (ids !== 'all' && ids.length === 0) {
      return NextResponse.json({ error: 'Missing ids' }, { status: 400 })
    }

    const count = await markNotificationsRead(userId, ids)
    return NextResponse.json({ success: true, marked: count })
  } catch (e) {
    logApiError('notifications/read', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Failed to mark read') }, { status: 500 })
  }
}
