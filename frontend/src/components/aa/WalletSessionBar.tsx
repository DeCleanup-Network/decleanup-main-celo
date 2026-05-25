'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useWallet } from '@/providers/WalletProvider'
import { getSessionCountdown } from '@/lib/client-wallet/signing-session'
import { getDeviceLabel } from '@/lib/client-wallet/device-label'

export function WalletSessionBar() {
  const { signingSession, endSigningSession, phase } = useWallet()
  const [, tick] = useState(0)

  useEffect(() => {
    if (!signingSession) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [signingSession])

  if (phase !== 'unlocked' || !signingSession) return null

  const countdown = getSessionCountdown(signingSession.expiresAt, signingSession.durationId)
  const device = getDeviceLabel()

  return (
    <div
      className={`rounded-xl border px-4 py-3 space-y-3 ${
        countdown.isUrgent
          ? 'border-amber-500/50 bg-amber-950/25'
          : 'border-brand-green/35 bg-brand-green/5'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-brand-green animate-pulse" />
            Ready to sign
          </p>
          <p className="text-sm text-gray-400">
            {countdown.untilLock
              ? 'Stays unlocked until you lock this tab'
              : `Unlocked · ${countdown.isExpired ? 'expired' : countdown.label} left`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            {countdown.untilLock ? 'Session' : 'Expires in'}
          </p>
          <p
            className={`font-mono text-lg tabular-nums ${
              countdown.isUrgent ? 'text-amber-300' : 'text-brand-green'
            }`}
          >
            {countdown.untilLock ? 'Until lock' : countdown.isExpired ? '00:00' : countdown.label}
          </p>
        </div>
      </div>

      <p className="text-xs text-gray-500">Device: {device}</p>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-gray-600 text-gray-300 sm:w-auto"
        onClick={() => endSigningSession()}
      >
        Lock wallet now
      </Button>
    </div>
  )
}
