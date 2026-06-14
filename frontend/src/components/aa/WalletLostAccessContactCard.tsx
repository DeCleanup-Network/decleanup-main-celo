'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { WALLET_PASSKEY_LOWER } from '@/lib/client-wallet/copy'

const LOST_ACCESS_EMAIL = 'support@decleanup.net'

type Props = {
  visible?: boolean
}

/**
 * Lost passkey: use MetaMask if exported, else email support for team reset.
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
            <strong className="text-gray-300">Exported to MetaMask before?</strong> Connect MetaMask from the{' '}
            <Link href="/" className="text-brand-green hover:underline">
              home page
            </Link>{' '}
            or sign-in screen. You use the key in MetaMask instead of the app {WALLET_PASSKEY_LOWER}.
          </p>
          <p>
            <strong className="text-gray-300">Never exported?</strong> Email{' '}
            <a href={`mailto:${LOST_ACCESS_EMAIL}`} className="text-brand-green hover:underline">
              {LOST_ACCESS_EMAIL}
            </a>{' '}
            from the address you use to sign in. Include your smart account address if you know it.
          </p>
          <p className="text-xs text-gray-500">
            A team reset creates a new smart account address. Previous onchain cleanups, DCU, and impact portfolio on
            the old address are not moved automatically.
          </p>
        </div>
      ) : null}
    </div>
  )
}
