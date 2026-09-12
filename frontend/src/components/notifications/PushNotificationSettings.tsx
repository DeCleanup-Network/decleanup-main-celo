'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useAccount, useSignMessage } from 'wagmi'
import { Button } from '@/components/ui/button'
import { signInWithConnectedWallet } from '@/lib/auth/client-wallet-signin'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches
}

type Props = {
  /** Compact layout for settings pages */
  className?: string
}

/**
 * On/off controls for email prefs + Web Push.
 * Google/email session or external wallet (one-time SIWE) can manage prefs.
 */
export function PushNotificationSettings({ className }: Props) {
  const { status, update } = useSession()
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [notifyEmail, setNotifyEmail] = useState(true)
  const [notifyPush, setNotifyPush] = useState(true)
  const [hasEmail, setHasEmail] = useState(true)

  const authenticated = status === 'authenticated'
  const walletReady = isConnected && Boolean(address)
  const canManage = authenticated
  const needsWalletAuth = !authenticated && walletReady

  useEffect(() => {
    setSupported(
      typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
    )
  }, [])

  const loadPrefs = useCallback(async () => {
    if (!authenticated) return
    try {
      const r = await fetch('/api/notifications/preferences', { credentials: 'include' })
      const d = await r.json()
      if (typeof d.notifyEmail === 'boolean') setNotifyEmail(d.notifyEmail)
      if (typeof d.notifyPush === 'boolean') setNotifyPush(d.notifyPush)
      if (typeof d.hasEmail === 'boolean') setHasEmail(d.hasEmail)
    } catch {
      /* ignore */
    }

    void navigator.serviceWorker?.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => setSubscribed(Boolean(sub)))
    )
  }, [authenticated])

  useEffect(() => {
    void loadPrefs()
  }, [loadPrefs])

  const ensureSession = useCallback(async (): Promise<boolean> => {
    if (authenticated) return true
    if (!address) {
      setMessage('Connect your wallet first.')
      return false
    }
    setMessage(null)
    const result = await signInWithConnectedWallet({
      address,
      signMessageAsync,
    })
    if (!result.ok) {
      setMessage(result.error)
      return false
    }
    await update()
    setMessage('Wallet authorized. You can manage notifications now.')
    return true
  }, [authenticated, address, signMessageAsync, update])

  const patchPrefs = async (patch: { notifyEmail?: boolean; notifyPush?: boolean }) => {
    const ok = await ensureSession()
    if (!ok) return false
    const res = await fetch('/api/notifications/preferences', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) void loadPrefs()
    return res.ok
  }

  const subscribe = useCallback(async () => {
    setBusy(true)
    setMessage(null)
    try {
      const sessionOk = await ensureSession()
      if (!sessionOk) return

      if (isIos() && !isStandalonePwa()) {
        setMessage(
          'On iPhone, add DeCleanup to your Home Screen first (Share → Add to Home Screen), then open that app and enable push here.'
        )
        return
      }
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
        credentials: 'include',
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
      void patchPrefs({ notifyPush: true })
      setMessage('Push notifications are on.')
      void loadPrefs()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Subscribe failed')
    } finally {
      setBusy(false)
    }
  }, [ensureSession, loadPrefs])

  const unsubscribe = useCallback(async () => {
    setBusy(true)
    setMessage(null)
    try {
      const sessionOk = await ensureSession()
      if (!sessionOk) return

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/notifications/push/subscribe', {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setSubscribed(false)
      setNotifyPush(false)
      void patchPrefs({ notifyPush: false })
      setMessage('Push notifications are off.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unsubscribe failed')
    } finally {
      setBusy(false)
    }
  }, [ensureSession])

  return (
    <section
      className={
        className ??
        'space-y-4 rounded-xl border border-white/10 bg-zinc-950/80 p-4 sm:p-5'
      }
    >
      <div>
        <h2 className="font-heading text-sm tracking-wider text-gray-400">Notifications</h2>
        <p className="mt-1 text-xs text-gray-500">
          Alerts for verified cleanups, rewards, and related updates.
        </p>
      </div>

      {!canManage && !needsWalletAuth ? (
        <p className="text-sm text-amber-100/90">
          Connect a wallet or sign in with Google/email to manage notifications.
        </p>
      ) : (
        <>
          {needsWalletAuth ? (
            <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <p className="text-sm text-gray-300">
                Sign once with your connected wallet to turn notifications on or off for this address.
              </p>
              <Button
                type="button"
                size="sm"
                className="w-full sm:w-auto"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true)
                    try {
                      const ok = await ensureSession()
                      if (ok) void loadPrefs()
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
              >
                {busy ? 'Waiting for signature…' : 'Authorize wallet for notifications'}
              </Button>
            </div>
          ) : null}

          {canManage || needsWalletAuth ? (
            <>
              {hasEmail && canManage ? (
                <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-gray-200">
                  <span>Email alerts</span>
                  <input
                    type="checkbox"
                    role="switch"
                    className="h-5 w-9 accent-brand-green"
                    checked={notifyEmail}
                    disabled={busy || !canManage}
                    onChange={(e) => {
                      const v = e.target.checked
                      setNotifyEmail(v)
                      void patchPrefs({ notifyEmail: v })
                    }}
                  />
                </label>
              ) : null}

              <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-gray-200">
                <span>Allow push alerts</span>
                <input
                  type="checkbox"
                  role="switch"
                  className="h-5 w-9 accent-brand-green"
                  checked={notifyPush}
                  disabled={busy}
                  onChange={(e) => {
                    const v = e.target.checked
                    setNotifyPush(v)
                    void (async () => {
                      setBusy(true)
                      try {
                        const ok = await patchPrefs({ notifyPush: v })
                        if (!ok) {
                          setNotifyPush(!v)
                          return
                        }
                        if (!v && subscribed) await unsubscribe()
                      } finally {
                        setBusy(false)
                      }
                    })()
                  }}
                />
              </label>

              {supported ? (
                <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
                  <p className="text-xs text-gray-500">
                    Device push:{' '}
                    <span className={subscribed ? 'text-brand-green' : 'text-gray-400'}>
                      {subscribed ? 'On' : 'Off'}
                    </span>
                    {isIos() && !isStandalonePwa()
                      ? ' — on iPhone, use the Home Screen app.'
                      : null}
                  </p>
                  {!subscribed ? (
                    <Button
                      type="button"
                      size="sm"
                      className="w-full sm:w-auto"
                      disabled={busy || !notifyPush}
                      onClick={() => void subscribe()}
                    >
                      {busy ? 'Enabling…' : 'Turn on push notifications'}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full border-white/10 sm:w-auto"
                      disabled={busy}
                      onClick={() => void unsubscribe()}
                    >
                      {busy ? 'Turning off…' : 'Turn off push notifications'}
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  Push is not available in this browser. On iPhone, add DeCleanup to Home Screen first.
                </p>
              )}
            </>
          ) : null}
        </>
      )}

      {message && <p className="text-xs text-gray-400">{message}</p>}
    </section>
  )
}
