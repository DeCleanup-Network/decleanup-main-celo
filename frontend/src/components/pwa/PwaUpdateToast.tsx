'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * When a new service worker is waiting, offer a one-tap reload so users leave stale shells.
 */
export function PwaUpdateToast() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    let cancelled = false
    let reg: ServiceWorkerRegistration | undefined

    const onUpdateFound = () => {
      const sw = reg?.installing
      if (!sw) return
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller && !cancelled) {
          setWaiting(sw)
        }
      })
    }

    void navigator.serviceWorker.ready.then((r) => {
      if (cancelled) return
      reg = r
      if (r.waiting) setWaiting(r.waiting)
      r.addEventListener('updatefound', onUpdateFound)
    })

    return () => {
      cancelled = true
      reg?.removeEventListener('updatefound', onUpdateFound)
    }
  }, [])

  if (!waiting) return null

  return (
    <div className="fixed inset-x-0 top-safe z-[60] flex justify-center px-3 pt-2">
      <div className="flex max-w-md items-center gap-3 rounded-xl border border-brand-green/40 bg-gray-950/95 px-3 py-2 text-sm shadow-lg backdrop-blur-md">
        <span className="text-foreground">App update ready</span>
        <Button
          type="button"
          size="sm"
          className="bg-brand-green text-black hover:bg-brand-green/90"
          onClick={() => {
            waiting.postMessage({ type: 'SKIP_WAITING' })
            window.location.reload()
          }}
        >
          Refresh
        </Button>
      </div>
    </div>
  )
}
