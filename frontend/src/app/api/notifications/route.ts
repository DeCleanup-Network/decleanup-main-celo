import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { listNotifications, unreadCount } from '@/lib/server/notifications/service'
import { apiErrorMessage, logApiError } from '@/lib/server/api-error'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    }

    const unreadOnly = request.nextUrl.searchParams.get('unread') === '1'
    const priority = request.nextUrl.searchParams.get('priority') === '1'
    const countOnly = request.nextUrl.searchParams.get('count') === '1'

    if (countOnly) {
      const count = await unreadCount(userId)
      return NextResponse.json({ count })
    }

    const { PRIORITY_MODAL_TYPES } = await import('@/lib/server/notifications/types')
    const items = await listNotifications(userId, {
      unreadOnly: unreadOnly || priority,
      limit: priority ? 5 : 50,
    })

    const filtered = priority
      ? items.filter((n) => (PRIORITY_MODAL_TYPES as readonly string[]).includes(n.type))
      : items

    const count = await unreadCount(userId)
    return NextResponse.json({ notifications: filtered, unreadCount: count })
  } catch (e) {
    logApiError('notifications/GET', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Failed to load notifications') }, { status: 500 })
  }
}
