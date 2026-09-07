'use client'

import { WalletPasscodeSetupWizard } from '@/components/aa/WalletPasscodeSetupWizard'

/** Home dashboard note after sign-in: wallet exists, passcode setup. */
export function WalletReadyCard() {
  return (
    <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-5 sm:p-6">
      <WalletPasscodeSetupWizard />
    </div>
  )
}
