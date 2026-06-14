'use client'

import { useSession } from 'next-auth/react'

/** Collapsed by default — keeps Account settings scannable. */
export function AccountHowItWorks() {
  const { data: session } = useSession()
  const email = session?.user?.email?.trim()

  return (
    <details className="group rounded-xl border border-gray-800 bg-gray-900/40 open:bg-gray-900/50">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium text-gray-300 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          How this works
          <span className="text-xs font-normal text-gray-500 group-open:hidden">(optional read)</span>
        </span>
      </summary>
      <div className="space-y-3 border-t border-gray-800 px-5 pb-5 pt-3 text-sm leading-relaxed text-gray-400">
        <p>
          <span className="font-medium text-gray-300">Sign-in</span> (Google or email) syncs your DeCleanup Rewards wallet. It does
          not unlock it.
          {email ? (
            <>
              {' '}
              Signed in as <span className="text-white">{email}</span>.
            </>
          ) : null}
        </p>
        <p>
          <span className="font-medium text-gray-300">Wallet passkey</span> is yours alone. Required on every new
          device after sign-in. Face ID is optional on this device only.
        </p>
        <p>
          <span className="font-medium text-gray-300">MetaMask backup (optional)</span> — export your signer key when
          ready. If you forget the app passkey later, connect MetaMask instead of unlocking here.
        </p>
      </div>
    </details>
  )
}
