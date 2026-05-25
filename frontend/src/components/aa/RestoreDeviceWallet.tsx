'use client'

import Link from 'next/link'
import { UnlockWallet } from '@/components/aa/UnlockWallet'
import { useWallet } from '@/providers/WalletProvider'
import { WALLET_PASSKEY } from '@/lib/client-wallet/copy'

/** Multi-device restore: server-synced wallet, unlock with original password. */
export function RestoreDeviceWallet() {
  const { isNewDevice } = useWallet()

  return (
    <div className="space-y-4">
      {isNewDevice && (
        <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-4 space-y-2">
          <h2 className="text-sm font-semibold text-white">New device detected</h2>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Your encrypted wallet was synced from your account. Enter your{' '}
            <strong className="text-gray-300">{WALLET_PASSKEY}</strong> (from wallet setup), not your Google
            login. Then enable Face ID / Touch ID for this device.
          </p>
          <p className="text-[11px] text-gray-500">
            Forgot {WALLET_PASSKEY}?{' '}
            <Link href="/import-wallet" className="text-brand-green underline">
              Restore from backup file
            </Link>
            .
          </p>
        </div>
      )}
      <UnlockWallet />
    </div>
  )
}
