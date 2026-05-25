'use client'

import { WalletPasskeySetupForm } from '@/components/aa/WalletPasskeySetupForm'
import { WALLET_PASSKEY, WALLET_PASSKEY_LOWER } from '@/lib/client-wallet/copy'

/** Smart account settings when passkey is not set yet — setup only, no home welcome copy */
export function PendingPasswordSettings() {
  return (
    <div className="rounded-xl border border-brand-green/25 bg-gray-900/50 p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-white">{WALLET_PASSKEY}</h2>
        <p className="mt-1 text-sm text-gray-400">
          Required before your first onchain submit or claim. You can also set it when prompted from the dashboard.
        </p>
      </div>
      <WalletPasskeySetupForm defaultOpen compact />
    </div>
  )
}
