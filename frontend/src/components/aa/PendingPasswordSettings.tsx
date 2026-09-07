'use client'

import { WalletPasscodeSetupWizard } from '@/components/aa/WalletPasscodeSetupWizard'

/** First-time account passcode — phone-style PIN, then optional Face ID. */
export function PendingPasswordSettings() {
  return (
    <div className="rounded-xl border border-brand-green/25 bg-gray-900/50 p-6">
      <WalletPasscodeSetupWizard />
    </div>
  )
}
