'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/**
 * Enable browser / PWA Web Push (iOS: Add to Home Screen required).
 */
export function PushNotificationSettings() {
  const { status } = useSession()
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [notifyEmail, setNotifyEmail] = useState(true)
  const [notifyPush, setNotifyPush] = useState(true)

  useEffect(() => {
    setSupported(
      typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
    )
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    void fetch('/api/notifications/preferences')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.notifyEmail === 'boolean') setNotifyEmail(d.notifyEmail)
        if (typeof d.notifyPush === 'boolean') setNotifyPush(d.notifyPush)
      })
      .catch(() => {})

    void navigator.serviceWorker?.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => setSubscribed(Boolean(sub)))
    )
  }, [status])

  const patchPrefs = async (patch: { notifyEmail?: boolean; notifyPush?: boolean }) => {
    await fetch('/api/notifications/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  }

  const subscribe = useCallback(async () => {
    setBusy(true)
    setMessage(null)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setMessage('Notification permission denied.')
        return
      }
      const keyRes = await fetch('/api/notifications/push/vapid-public')
      const keyData = await keyRes.json()
      if (!keyRes.ok || !keyData.publicKey) {
        setMessage('Web Push is not configured on the server yet.')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey) as BufferSource,
      })
      const json = sub.toJSON()
      const res = await fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      })
      if (!res.ok) {
        setMessage('Could not save subscription.')
        return
      }
      setSubscribed(true)
      setNotifyPush(true)
      setMessage('Push notifications enabled.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Subscribe failed')
    } finally {
      setBusy(false)
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    setBusy(true)
    setMessage(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/notifications/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setSubscribed(false)
      setMessage('Push notifications disabled.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unsubscribe failed')
    } finally {
      setBusy(false)
    }
  }, [])

  if (status !== 'authenticated') return null

  return (
    <section className="space-y-3 rounded-xl border border-white/10 bg-zinc-950/80 p-4">
      <h2 className="font-heading text-sm tracking-wider text-gray-400">Notifications</h2>
      <label className="flex items-center gap-2 text-sm text-gray-300">
        <input
          type="checkbox"
          checked={notifyEmail}
          onChange={(e) => {
            const v = e.target.checked
            setNotifyEmail(v)
            void patchPrefs({ notifyEmail: v })
          }}
        />
        Email for rewards &amp; security events
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-300">
        <input
          type="checkbox"
          checked={notifyPush}
          onChange={(e) => {
            const v = e.target.checked
            setNotifyPush(v)
            void patchPrefs({ notifyPush: v })
          }}
        />
        Allow push when subscribed
      </label>
      {supported ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {!subscribed ? (
            <Button type="button" size="sm" variant="brandGhost" disabled={busy} onClick={() => void subscribe()}>
              {busy ? 'Enabling…' : 'Enable push notifications'}
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void unsubscribe()}>
              Disable push
            </Button>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-500">
          Push requires a supporting browser. On iPhone, add DeCleanup to your Home Screen first.
        </p>
      )}
      {message && <p className="text-xs text-gray-400">{message}</p>}
    </section>
  )
}
