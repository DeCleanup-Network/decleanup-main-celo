import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db/prisma'
import { apiErrorMessage, logApiError } from '@/lib/server/api-error'
import { userHasRealEmail } from '@/lib/server/notifications/resolve-user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notifyEmail: true, notifyPush: true, email: true },
    })
    return NextResponse.json({
      notifyEmail: user?.notifyEmail ?? true,
      notifyPush: user?.notifyPush ?? true,
      hasEmail: userHasRealEmail(user?.email),
    })
  } catch (e) {
    logApiError('notifications/preferences GET', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Failed') }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    }
    const body = (await request.json()) as { notifyEmail?: boolean; notifyPush?: boolean }
    const data: { notifyEmail?: boolean; notifyPush?: boolean } = {}
    if (typeof body.notifyEmail === 'boolean') data.notifyEmail = body.notifyEmail
    if (typeof body.notifyPush === 'boolean') data.notifyPush = body.notifyPush
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    if (data.notifyEmail !== undefined) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      })
      if (!userHasRealEmail(user?.email)) {
        delete data.notifyEmail
      }
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    await prisma.user.update({ where: { id: userId }, data })
    return NextResponse.json({ success: true, ...data })
  } catch (e) {
    logApiError('notifications/preferences PATCH', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Update failed') }, { status: 500 })
  }
}
