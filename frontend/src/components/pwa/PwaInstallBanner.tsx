'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, Share, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const DISMISS_KEY = 'decleanup-pwa-install-dismissed'
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return true
  const mq = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone =
    'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return mq || iosStandalone
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const webkit = /WebKit/.test(ua)
  const chromeOrCriOS = /CriOS|FxiOS|EdgiOS|OPiOS|Chrome\//.test(ua)
  return iOS && webkit && !chromeOrCriOS
}

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const at = Number(raw)
    return Number.isFinite(at) && Date.now() - at < DISMISS_MS
  } catch {
    return false
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    // ignore
  }
}

/**
 * Chromium: native install via beforeinstallprompt.
 * iOS Safari: instruction sheet (Share → Add to Home Screen).
 */
export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isStandaloneDisplay() || wasDismissedRecently()) return

    const onBip = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onBip)

    if (isIosSafari()) {
      setShowIosHelp(true)
      setVisible(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [])

  const dismiss = useCallback(() => {
    markDismissed()
    setVisible(false)
    setDeferred(null)
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return
    await deferred.prompt()
    try {
      await deferred.userChoice
    } catch {
      // ignore
    }
    setDeferred(null)
    setVisible(false)
    markDismissed()
  }, [deferred])

  if (!visible) return null

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-brand-green/30 bg-gray-950/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur-md"
      role="dialog"
      aria-label="Install DeCleanup Rewards"
    >
      <div className="mx-auto flex max-w-lg items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-green/15 text-brand-green">
          {showIosHelp && !deferred ? <Share className="h-4 w-4" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Install DeCleanup Rewards</p>
          {showIosHelp && !deferred ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Tap <span className="text-foreground">Share</span>, then{' '}
              <span className="text-foreground">Add to Home Screen</span> for a full-screen app.
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Add to your home screen for quicker access (same login &amp; wallets).
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {deferred ? (
              <Button type="button" size="sm" onClick={() => void install()} className="bg-brand-green text-black hover:bg-brand-green/90">
                Install
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="outline" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
