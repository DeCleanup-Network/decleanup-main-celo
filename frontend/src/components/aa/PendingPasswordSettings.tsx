'use client'

import { WalletPasskeySetupForm } from '@/components/aa/WalletPasskeySetupForm'
import { WALLET_PASSKEY, WALLET_PASSKEY_LOWER } from '@/lib/client-wallet/copy'

/** First-time wallet passkey — after protection overview on Smart account settings. */
export function PendingPasswordSettings() {
  return (
    <div className="rounded-xl border border-brand-green/25 bg-gray-900/50 p-6 space-y-4">
      <div>
        <h2 className="font-bebas text-lg tracking-wide text-white">CREATE &amp; SAVE YOUR {WALLET_PASSKEY.toUpperCase()}</h2>
        <p className="mt-2 text-sm text-gray-400 leading-relaxed">
          Choose a {WALLET_PASSKEY_LOWER} you will remember, or store it in a password manager. There is no
          other way to recover this wallet if you lose it — we cannot reset it for you.
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Required before your first onchain submit or claim.
        </p>
      </div>
      <WalletPasskeySetupForm defaultOpen compact />
    </div>
  )
}
