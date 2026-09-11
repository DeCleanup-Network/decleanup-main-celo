import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
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

    const body = (await request.json()) as {
      endpoint?: string
      keys?: { p256dh?: string; auth?: string }
    }

    const endpoint = body.endpoint?.trim()
    const p256dh = body.keys?.p256dh?.trim()
    const authKey = body.keys?.auth?.trim()
    if (!endpoint || !p256dh || !authKey) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId,
        endpoint,
        p256dh,
        auth: authKey,
      },
      update: {
        userId,
        p256dh,
        auth: authKey,
      },
    })

    await prisma.user.update({
      where: { id: userId },
      data: { notifyPush: true },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    logApiError('notifications/push/subscribe', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Subscribe failed') }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { endpoint?: string }
    if (body.endpoint) {
      await prisma.pushSubscription.deleteMany({
        where: { userId, endpoint: body.endpoint },
      })
    } else {
      await prisma.pushSubscription.deleteMany({ where: { userId } })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    logApiError('notifications/push/unsubscribe', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Unsubscribe failed') }, { status: 500 })
  }
}
