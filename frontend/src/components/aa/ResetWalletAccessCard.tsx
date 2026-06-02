'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWallet } from '@/providers/WalletProvider'

type Props = {
  visible: boolean
}

export function ResetWalletAccessCard({ visible }: Props) {
  const { resetWalletAccess } = useWallet()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (!visible) return null

  const onReset = async () => {
    const confirmed = window.confirm(
      'Reset wallet passkey?\n\nThis removes your current smart wallet from this account and device, then creates a new one. Old wallet access cannot be recovered without your previous wallet passkey or backup file.'
    )
    if (!confirmed) return

    setPending(true)
    setError(null)
    setDone(false)
    try {
      await resetWalletAccess()
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset wallet passkey')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-amber-200">Forgot wallet passkey?</h3>
          <p className="text-xs text-amber-100/90">
            You can reset app wallet access on this Google account. This is destructive: a new wallet will be created
            and the old wallet address will no longer be usable from this account unless you still have its backup.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-amber-500/60 text-amber-200 hover:bg-amber-500/15"
            onClick={() => void onReset()}
            disabled={pending}
          >
            {pending ? 'Resetting wallet…' : 'Reset wallet passkey'}
          </Button>
          {done ? (
            <p className="text-xs text-brand-green">
              Wallet reset started. A new wallet will appear after account bootstrap completes.
            </p>
          ) : null}
          {error ? <p className="text-xs text-red-300">{error}</p> : null}
        </div>
      </div>
    </section>
  )
}
