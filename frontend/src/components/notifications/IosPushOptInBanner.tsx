'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { isAaAuthEnabledClient } from '@/lib/auth/is-aa-auth-enabled'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function isIosStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  const standalone = nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent)
  return ios && standalone
}

const DISMISS_KEY = 'decleanup_push_prompt_dismissed'

/**
 * iPhone only delivers Web Push from an Add-to-Home-Screen PWA after the user opts in.
 * Prompt once when running standalone and not yet subscribed.
 */
export function IosPushOptInBanner() {
  const aa = isAaAuthEnabledClient()
  const { status } = useSession()
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!aa || status !== 'authenticated') return
    if (!isIosStandalone()) return
    if (localStorage.getItem(DISMISS_KEY)) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    let cancelled = false
    void navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => {
        if (!cancelled && !sub) setShow(true)
      })
    )
    return () => {
      cancelled = true
    }
  }, [aa, status])

  const enable = useCallback(async () => {
    setBusy(true)
    setMessage(null)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setMessage('Permission denied. You can enable later in Account settings.')
        return
      }
      const keyRes = await fetch('/api/notifications/push/vapid-public')
      const keyData = await keyRes.json()
      if (!keyRes.ok || !keyData.publicKey) {
        setMessage('Push is not configured on the server yet.')
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
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      })
      if (!res.ok) {
        setMessage('Could not save subscription.')
        return
      }
      localStorage.setItem(DISMISS_KEY, '1')
      setShow(false)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Enable failed')
    } finally {
      setBusy(false)
    }
  }, [])

  if (!show) return null

  return (
    <div className="mx-auto mb-4 max-w-3xl rounded-xl border border-brand-green/30 bg-brand-green/10 px-4 py-3">
      <p className="text-sm text-foreground">
        Get alerts when cleanups are verified (works on iPhone only from the Home Screen app).
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => void enable()}>
          {busy ? 'Enabling…' : 'Enable notifications'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="brandGhost"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, '1')
            setShow(false)
          }}
        >
          Not now
        </Button>
      </div>
      {message && <p className="mt-2 text-xs text-amber-200">{message}</p>}
    </div>
  )
}
