'use client'

import { WALLET_PASSKEY_LOWER } from '@/lib/client-wallet/copy'

type Props = {
  visible?: boolean
}

/**
 * No self-service wallet reset — contact team only.
 */
export function WalletLostAccessContactCard({ visible = true }: Props) {
  if (!visible) return null

  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/30 p-4">
      <h3 className="font-bebas text-lg tracking-wide text-gray-200">LOST ACCESS / NEW WALLET</h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-400">
        If you lost your {WALLET_PASSKEY_LOWER} and did not save a backup, the only way to attach a new smart
        account to this email login is a manual reset by the DeCleanup team.
      </p>
      <p className="mt-2 text-sm text-gray-400">
        Email{' '}
        <a href="mailto:support@decleanup.net" className="text-brand-green hover:underline">
          support@decleanup.net
        </a>{' '}
        from the address you use to sign in. Include your smart account address if you know it.
      </p>
      <p className="mt-2 text-xs text-gray-500">
        We do not offer a self-service reset in the app — a reset creates a new onchain address and cannot
        recover old cleanups or levels without your backup file.
      </p>
    </section>
  )
}
