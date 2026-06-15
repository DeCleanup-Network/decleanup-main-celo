'use client'

import { WalletPasscodeSetupWizard } from '@/components/aa/WalletPasscodeSetupWizard'

/** First-time wallet passcode — phone-style PIN, then optional Face ID. */
export function PendingPasswordSettings() {
  return (
    <div className="rounded-xl border border-brand-green/25 bg-gray-900/50 p-6 space-y-6">
      <div className="text-center sm:text-left">
        <h2 className="font-heading text-lg tracking-wide text-white">CREATE YOUR WALLET PASSCODE</h2>
        <p className="mt-2 text-sm text-gray-400 leading-relaxed">
          Pick 6 digits you will remember. On a new device, sign in with Google or email and enter the same
          passcode. Optional: export to MetaMask later for your own backup.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Required before your first onchain submit or claim. Not your Google password.
        </p>
      </div>
      <WalletPasscodeSetupWizard />
    </div>
  )
}
