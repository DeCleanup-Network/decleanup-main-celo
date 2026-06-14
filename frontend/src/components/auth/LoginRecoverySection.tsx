'use client'

import Link from 'next/link'
import { WALLET_PASSKEY_LOWER } from '@/lib/client-wallet/copy'

const LOST_ACCESS_EMAIL = 'support@decleanup.net'

type Props = {
  callbackUrl: string
}

/** Lost wallet passkey: MetaMask if exported, else email support. */
export function LoginRecoverySection(_props: Props) {
  return (
    <div className="rounded-lg border border-gray-700/80 bg-gray-900/40 px-3 py-3 text-left">
      <p className="text-xs font-medium text-gray-300">Forgot your wallet passkey?</p>
      <p className="mt-1 text-[10px] leading-relaxed text-gray-500">
        On a new device, sign in with Google or email and enter your {WALLET_PASSKEY_LOWER}. If you exported your
        signer key to MetaMask earlier,{' '}
        <Link href="/" className="text-brand-green hover:underline">
          connect MetaMask
        </Link>{' '}
        instead. Otherwise email{' '}
        <a href={`mailto:${LOST_ACCESS_EMAIL}`} className="text-brand-green hover:underline">
          {LOST_ACCESS_EMAIL}
        </a>{' '}
        for a team reset.
      </p>
    </div>
  )
}
