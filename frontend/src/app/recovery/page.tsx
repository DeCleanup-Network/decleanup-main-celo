'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { BackToDeCleanupLink } from '@/components/layout/BackToDeCleanupLink'
import { ImportBackupForm } from '@/components/aa/ImportBackupForm'
import { isAaAuthEnabledClient } from '@/lib/auth/is-aa-auth-enabled'
import { WALLET_PASSKEY, WALLET_PASSKEY_LOWER } from '@/lib/client-wallet/copy'

export default function RecoveryPage() {
  const { status } = useSession()
  const router = useRouter()
  const aaEnabled = isAaAuthEnabledClient()

  useEffect(() => {
    if (aaEnabled && status === 'unauthenticated') {
      router.replace('/login?callbackUrl=/recovery')
    }
  }, [aaEnabled, status, router])

  if (!aaEnabled) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-gray-400">
        AA wallet recovery is not enabled.
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-gray-400">
        Loading…
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-gray-400">
        Redirecting to sign in…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 px-4 py-12">
      <div>
        <BackToDeCleanupLink />
        <h1 className="mt-2 font-heading text-2xl tracking-wider text-white sm:text-3xl">Wallet recovery</h1>
        <p className="mt-2 text-sm text-gray-400 leading-relaxed">
          DeCleanup Rewards never stores your private key. Recovery depends on your{' '}
          <strong className="text-gray-300">encrypted backup file</strong> and{' '}
          <strong className="text-gray-300">{WALLET_PASSKEY}</strong>.
        </p>
      </div>

      <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-5 space-y-3 text-sm text-gray-400">
        <h2 className="text-sm font-semibold text-white">If you still have your device</h2>
        <ol className="list-decimal list-inside space-y-2 text-[13px]">
          <li>Sign in with Google on the new device.</li>
          <li>Your encrypted wallet syncs automatically.</li>
          <li>Enter your {WALLET_PASSKEY_LOWER} to start a signing session.</li>
          <li>Optionally enable Face ID / Touch ID on the new device.</li>
        </ol>
        <Link href="/wallet" className="inline-block text-brand-green underline text-xs">
          Go to dashboard
        </Link>
      </section>

      <section className="rounded-xl border border-amber-800/40 bg-amber-950/15 p-5 space-y-3 text-sm">
        <h2 className="text-sm font-semibold text-amber-200">Lost device or {WALLET_PASSKEY_LOWER}?</h2>
        <p className="text-[13px] text-gray-400">
          Restore from the <code className="text-gray-300">.json</code> backup you downloaded from
          Backup &amp; export. Without the backup file and {WALLET_PASSKEY_LOWER}, funds cannot be recovered.
          We cannot decrypt your wallet.
        </p>
      </section>

      <ImportBackupForm redirectTo="/wallet" />

      <p className="text-center text-[11px] text-gray-600">
        <Link href="/import-wallet" className="text-gray-500 underline">
          Advanced import options
        </Link>
      </p>
    </div>
  )
}
