'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { AlertModal } from '@/components/ui/alert-modal'
import { isAaAuthEnabledClient } from '@/lib/auth/is-aa-auth-enabled'
import type { NotificationDto } from '@/lib/server/notifications/types'

/**
 * One-shot home modal for high-priority unread notifications.
 */
export function PriorityNotificationModal() {
  const aa = isAaAuthEnabledClient()
  const { status } = useSession()
  const [item, setItem] = useState<NotificationDto | null>(null)

  useEffect(() => {
    if (!aa || status !== 'authenticated') return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/notifications?priority=1&unread=1', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { notifications?: NotificationDto[] }
        const first = data.notifications?.[0]
        if (first && !cancelled) setItem(first)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [aa, status])

  if (!item) return null

  const dismiss = () => {
    const id = item.id
    setItem(null)
    void fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  return (
    <AlertModal
      isOpen
      onClose={dismiss}
      title={item.title}
      message={
        <div className="space-y-3">
          <p className="text-gray-300">{item.body}</p>
          {item.href && (
            <Link
              href={item.href}
              className="inline-flex font-medium text-brand-green underline underline-offset-2"
              onClick={dismiss}
            >
              Continue
            </Link>
          )}
        </div>
      }
      variant={
        item.type.includes('declined') || item.type.includes('fail')
          ? 'error'
          : item.type.includes('welcome') || item.type.includes('verified')
            ? 'success'
            : 'info'
      }
    />
  )
}
