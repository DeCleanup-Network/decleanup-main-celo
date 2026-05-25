'use client'

import Link from 'next/link'

type Props = {
  callbackUrl: string
}

/**
 * Recovery phrase / private key import requires a session first — link to import flow after sign-in.
 */
export function LoginRecoverySection({ callbackUrl }: Props) {
  const importUrl = `/import-wallet?callbackUrl=${encodeURIComponent(callbackUrl)}`

  return (
    <div className="rounded-lg border border-gray-700/80 bg-gray-900/40 px-3 py-3 text-left">
      <p className="text-xs font-medium text-gray-300">Already have a wallet backup?</p>
      <p className="mt-1 text-[10px] leading-relaxed text-gray-500">
        Sign in with Google or email first. Then import your{' '}
        <strong className="font-normal text-gray-400">recovery JSON</strong> or{' '}
        <strong className="font-normal text-gray-400">private key</strong> (hex connection string).
      </p>
      <Link
        href={importUrl}
        className="mt-2 inline-block text-xs text-brand-green hover:underline"
      >
        Import recovery phrase or private key →
      </Link>
    </div>
  )
}
