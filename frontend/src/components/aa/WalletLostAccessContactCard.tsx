'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { WALLET_PASSKEY_LOWER } from '@/lib/client-wallet/copy'

const LOST_ACCESS_EMAIL = 'decentralizedcleanup@gmail.com'

type Props = {
  visible?: boolean
}

/**
 * No self-service wallet reset — contact team only (collapsible).
 */
export function WalletLostAccessContactCard({ visible = true }: Props) {
  const [open, setOpen] = useState(false)

  if (!visible) return null

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <h2 className="font-bebas text-lg tracking-wide text-gray-200">LOST ACCESS / NEW WALLET</h2>
        {open ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
        )}
      </button>

      {open ? (
        <div className="space-y-3 border-t border-gray-800 px-4 pb-4 pt-2 text-sm leading-relaxed text-gray-400">
          <p>
            If you lost your {WALLET_PASSKEY_LOWER} and did not save a backup, the only way to attach a new smart
            account to this email login is a manual reset by the DeCleanup Network team.
          </p>
          <p>
            Email{' '}
            <a href={`mailto:${LOST_ACCESS_EMAIL}`} className="text-brand-green hover:underline">
              {LOST_ACCESS_EMAIL}
            </a>{' '}
            from the address you use to sign in. Include your smart account address if you know it.
          </p>
          <p className="text-xs text-gray-500">
            We do not offer a self-service reset in the app - a reset creates a new onchain address and cannot
            recover old cleanups or levels without your backup file.
          </p>
        </div>
      ) : null}
    </div>
  )
}
