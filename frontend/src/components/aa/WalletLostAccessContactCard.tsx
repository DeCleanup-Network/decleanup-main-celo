'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWallet } from '@/providers/WalletProvider'
import { WALLET_PASSKEY_LOWER } from '@/lib/client-wallet/copy'

const LOST_ACCESS_EMAIL = 'support@decleanup.net'

type Props = {
  visible?: boolean
}

/**
 * Lost passkey: self-service reset when signed in, or email support@decleanup.net.
 */
export function WalletLostAccessContactCard({ visible = true }: Props) {
  const [open, setOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const { resetWalletAccess, smartAccountAddress, phase } = useWallet()

  if (!visible) return null

  const canSelfReset = phase !== 'loading' && phase !== 'no-wallet'

  const handleReset = async () => {
    const addr = smartAccountAddress ? `\n\nCurrent smart account:\n${smartAccountAddress}` : ''
    const ok = window.confirm(
      `Start a new wallet for this login?\n\n` +
        `• You will set a new ${WALLET_PASSKEY_LOWER} on next setup\n` +
        `• You get a NEW smart account address\n` +
        `• Old onchain cleanups and levels stay on the previous address${addr}\n\n` +
        `Only continue if you lost your ${WALLET_PASSKEY_LOWER} and have no backup file.`
    )
    if (!ok) return
    setResetting(true)
    setResetError(null)
    try {
      await resetWalletAccess()
    } catch (e) {
      setResetError(e instanceof Error ? e.message : 'Reset failed')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <h2 className="font-heading text-lg tracking-wide text-gray-200">LOST ACCESS / NEW WALLET</h2>
        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
        )}
      </button>

      {open ? (
        <div className="space-y-3 border-t border-gray-800 px-4 pb-4 pt-2 text-sm leading-relaxed text-gray-400">
          <p>
            If you forgot your {WALLET_PASSKEY_LOWER} and have no backup file, you can start fresh with a new
            smart account on this login.
          </p>
          {canSelfReset ? (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-amber-700/50 text-amber-200 hover:bg-amber-950/30"
                disabled={resetting}
                onClick={() => void handleReset()}
              >
                {resetting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting…
                  </>
                ) : (
                  'Start new wallet (forgot passkey)'
                )}
              </Button>
              {resetError ? <p className="text-xs text-red-400">{resetError}</p> : null}
            </div>
          ) : null}
          <p>
            Cannot sign in, or need help from the team? Email{' '}
            <a href={`mailto:${LOST_ACCESS_EMAIL}`} className="text-brand-green hover:underline">
              {LOST_ACCESS_EMAIL}
            </a>{' '}
            from the address you use to sign in. Include your smart account address if you know it.
          </p>
          <p className="text-xs text-gray-500">
            A reset creates a new onchain address. Previous cleanups, DCU, and impact portfolio on the old
            address are not moved unless you restore from a backup file.
          </p>
        </div>
      ) : null}
    </div>
  )
}
