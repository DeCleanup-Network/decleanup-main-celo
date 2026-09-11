import 'server-only'
import { prisma } from '@/lib/db/prisma'

type PushPayload = {
  title: string
  body: string
  href?: string | null
  type?: string
}

function vapidConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY?.trim() &&
      process.env.VAPID_PRIVATE_KEY?.trim() &&
      process.env.VAPID_SUBJECT?.trim()
  )
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null
}

/**
 * Send Web Push to all subscriptions for a user. Drops gone subscriptions (410/404).
 */
export async function sendWebPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!vapidConfigured()) return

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notifyPush: true },
  })
  if (user?.notifyPush === false) return

  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  if (subs.length === 0) return

  let webpush: typeof import('web-push')
  try {
    webpush = await import('web-push')
  } catch {
    console.warn('[notifications/push] web-push package not available')
    return
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!.trim(),
    process.env.VAPID_PUBLIC_KEY!.trim(),
    process.env.VAPID_PRIVATE_KEY!.trim()
  )

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    href: payload.href || '/',
    type: payload.type,
  })

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        )
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        } else {
          console.warn('[notifications/push] send failed:', status || err)
        }
      }
    })
  )
}
