'use client'

import Link from 'next/link'
import { useWallet } from '@/providers/WalletProvider'
import { WalletPasskeySetupForm } from '@/components/aa/WalletPasskeySetupForm'
import { WALLET_PASSKEY_LOWER } from '@/lib/client-wallet/copy'

/** Home dashboard note after sign-in: wallet exists, passkey can wait until first submit. */
export function WalletReadyCard() {
  const { smartAccountAddress } = useWallet()

  return (
    <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-5 sm:p-6 space-y-4">
      <div className="space-y-2">
        <h2 className="font-bebas text-xl tracking-wider text-white sm:text-2xl">You&apos;re in</h2>
        <p className="text-sm text-gray-300 leading-relaxed">
          Your smart wallet is ready. Set a {WALLET_PASSKEY_LOWER} when you first submit onchain, or finish setup in{' '}
          <Link href="/wallet" className="font-medium text-brand-green underline underline-offset-2">
            Smart account settings
          </Link>{' '}
          before you start.
        </p>
      </div>
      {smartAccountAddress && (
        <p className="font-mono text-xs text-gray-500 break-all sm:text-sm">
          Wallet: {smartAccountAddress}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <WalletPasskeySetupForm />
        <Link
          href="/wallet"
          className="text-xs text-gray-400 underline underline-offset-2 hover:text-brand-green"
        >
          Open Smart account settings
        </Link>
      </div>
    </div>
  )
}
