'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { WALLET_PASSKEY_LOWER } from '@/lib/client-wallet/copy'

const LOST_ACCESS_EMAIL = 'support@decleanup.net'

type Props = {
  visible?: boolean
}

/**
 * Lost passkey: contact support@decleanup.net for a team-assisted wallet reset.
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
            If you forgot your {WALLET_PASSKEY_LOWER}, email the team to reset your wallet for this login.
          </p>
          <p>
            Email{' '}
            <a href={`mailto:${LOST_ACCESS_EMAIL}`} className="text-brand-green hover:underline">
              {LOST_ACCESS_EMAIL}
            </a>{' '}
            from the address you use to sign in. Include your smart account address if you know it.
          </p>
          <p className="text-xs text-gray-500">
            After a reset you set a new {WALLET_PASSKEY_LOWER} and get a new smart account address. Previous
            onchain cleanups, DCU, and impact portfolio on the old address are not moved automatically.
          </p>
        </div>
      ) : null}
    </div>
  )
}
