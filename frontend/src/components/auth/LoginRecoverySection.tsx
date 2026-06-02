'use client'

import Link from 'next/link'

type Props = {
  callbackUrl: string
}

/** Backup import lives on /import-wallet (file upload) after Google or email sign-in. */
export function LoginRecoverySection({ callbackUrl }: Props) {
  const importUrl = `/import-wallet?callbackUrl=${encodeURIComponent(callbackUrl)}`

  return (
    <div className="rounded-lg border border-gray-700/80 bg-gray-900/40 px-3 py-3 text-left">
      <p className="text-xs font-medium text-gray-300">Forgot your wallet passkey?</p>
      <p className="mt-1 text-[10px] leading-relaxed text-gray-500">
        Sign in with Google or email, then import your encrypted backup to keep the same onchain wallet.
        Without a backup, we cannot recover your wallet (non-custodial).
      </p>
      <Link
        href={importUrl}
        className="mt-2 inline-block text-xs text-brand-green hover:underline"
      >
        Import backup file →
      </Link>
    </div>
  )
}
