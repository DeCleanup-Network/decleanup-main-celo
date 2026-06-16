'use client'

import { useWallet } from '@/providers/WalletProvider'
import { WalletPasscodeSetupWizard } from '@/components/aa/WalletPasscodeSetupWizard'
import { WALLET_PASSCODE_LOWER } from '@/lib/client-wallet/copy'

/** Home dashboard note after sign-in: wallet exists, passcode setup. */
export function WalletReadyCard() {
  const { eoaAddress } = useWallet()

  return (
    <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-5 sm:p-6 space-y-5">
      <div className="space-y-2 text-center sm:text-left">
        <h2 className="font-heading text-xl tracking-wider text-white sm:text-2xl">YOU&apos;RE IN</h2>
        <p className="text-sm text-gray-300 leading-relaxed">
          Your wallet is ready. Create a 6-digit {WALLET_PASSCODE_LOWER} to continue.
        </p>
      </div>
      {eoaAddress && (
        <p className="font-mono text-xs text-gray-500 break-all sm:text-sm">
          Wallet: {eoaAddress}
        </p>
      )}
      <WalletPasscodeSetupWizard />
    </div>
  )
}
