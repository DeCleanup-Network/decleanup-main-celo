'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { isAaAuthEnabledClient } from '@/lib/auth/is-aa-auth-enabled'
import type { NotificationDto } from '@/lib/server/notifications/types'

export function NotificationBell() {
  const aa = isAaAuthEnabledClient()
  const { status } = useSession()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationDto[]>([])
  const [unread, setUnread] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!aa || status !== 'authenticated') return
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as {
        notifications?: NotificationDto[]
        unreadCount?: number
      }
      setItems(data.notifications || [])
      setUnread(data.unreadCount || 0)
    } catch {
      /* ignore */
    }
  }, [aa, status])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 60_000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!aa || status !== 'authenticated') return null

  const markRead = async (id: string) => {
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
    )
    setUnread((c) => Math.max(0, c - 1))
  }

  const markAll = async () => {
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: 'all' }),
    }).catch(() => {})
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })))
    setUnread(0)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-300 transition hover:bg-white/5 hover:text-white"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        onClick={() => {
          setOpen((o) => !o)
          if (!open) void load()
        }}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-green px-1 text-[10px] font-semibold text-black">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-[60] mt-2 w-[min(100vw-1.5rem,22rem)] overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <p className="font-heading text-sm tracking-wide text-white">Inbox</p>
            {unread > 0 && (
              <button
                type="button"
                className="text-xs text-brand-green hover:underline"
                onClick={() => void markAll()}
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-gray-500">No notifications yet</li>
            ) : (
              items.map((n) => (
                <li key={n.id} className="border-b border-white/5 last:border-0">
                  <Link
                    href={n.href || '/'}
                    className={`block px-3 py-2.5 transition hover:bg-white/[0.04] ${
                      n.readAt ? 'opacity-70' : ''
                    }`}
                    onClick={() => {
                      if (!n.readAt) void markRead(n.id)
                      setOpen(false)
                    }}
                  >
                    <p className="text-sm font-medium text-white">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-gray-400">{n.body}</p>
                    <p className="mt-1 text-[10px] text-gray-600">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
