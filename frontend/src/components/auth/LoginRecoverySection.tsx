'use client'

const LOST_ACCESS_EMAIL = 'support@decleanup.net'

type Props = {
  callbackUrl: string
}

/** Lost wallet passkey: sign in first, then email support for a team reset. */
export function LoginRecoverySection(_props: Props) {
  return (
    <div className="rounded-lg border border-gray-700/80 bg-gray-900/40 px-3 py-3 text-left">
      <p className="text-xs font-medium text-gray-300">Forgot your wallet passkey?</p>
      <p className="mt-1 text-[10px] leading-relaxed text-gray-500">
        Sign in with Google or email on a new device to load your wallet, then enter your wallet passkey. If you
        forgot it, email{' '}
        <a href={`mailto:${LOST_ACCESS_EMAIL}`} className="text-brand-green hover:underline">
          {LOST_ACCESS_EMAIL}
        </a>{' '}
        from your sign-in address for a team reset.
      </p>
    </div>
  )
}
