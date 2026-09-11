import 'server-only'
import { prisma } from '@/lib/db/prisma'
import type { CreateNotificationInput, NotificationDto } from './types'
import { resolveUserEmail } from './resolve-user'
import { sendNotificationEmail } from './email'
import { sendWebPushToUser } from './push'

function toDto(row: {
  id: string
  type: string
  title: string
  body: string
  href: string | null
  meta: unknown
  readAt: Date | null
  createdAt: Date
}): NotificationDto {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    href: row.href,
    meta: (row.meta as Record<string, unknown> | null) ?? null,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Central fan-out: inbox + optional Resend email + Web Push.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<NotificationDto | null> {
  try {
    let dto: NotificationDto | null = null

    if (!input.skipInbox) {
      const row = await prisma.userNotification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          href: input.href ?? null,
          meta: (input.meta ?? undefined) as object | undefined,
        },
      })
      dto = toDto(row)
    }

    if (!input.skipEmail) {
      const email = await resolveUserEmail(input.userId)
      if (email) {
        void sendNotificationEmail({
          to: email,
          subject: input.title,
          title: input.title,
          body: input.body,
          href: input.href,
        }).catch((e) => console.warn('[notifications] email error', e))
      }
    }

    if (!input.skipPush) {
      void sendWebPushToUser(input.userId, {
        title: input.title,
        body: input.body,
        href: input.href,
        type: input.type,
      }).catch((e) => console.warn('[notifications] push error', e))
    }

    return dto
  } catch (e) {
    console.error('[notifications] createNotification failed', e)
    return null
  }
}

export async function listNotifications(
  userId: string,
  opts?: { limit?: number; unreadOnly?: boolean }
): Promise<NotificationDto[]> {
  const limit = Math.min(opts?.limit ?? 50, 100)
  const rows = await prisma.userNotification.findMany({
    where: {
      userId,
      ...(opts?.unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return rows.map(toDto)
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.userNotification.count({
    where: { userId, readAt: null },
  })
}

export async function markNotificationsRead(
  userId: string,
  ids: string[] | 'all'
): Promise<number> {
  const now = new Date()
  if (ids === 'all') {
    const result = await prisma.userNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: now },
    })
    return result.count
  }
  if (ids.length === 0) return 0
  const result = await prisma.userNotification.updateMany({
    where: { userId, id: { in: ids }, readAt: null },
    data: { readAt: now },
  })
  return result.count
}

export async function getPriorityUnread(userId: string, types: readonly string[]) {
  return prisma.userNotification.findFirst({
    where: {
      userId,
      readAt: null,
      type: { in: [...types] },
    },
    orderBy: { createdAt: 'desc' },
  })
}
