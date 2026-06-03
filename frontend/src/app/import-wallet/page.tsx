'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { BackToDeCleanupLink } from '@/components/layout/BackToDeCleanupLink'
import { ImportBackupForm } from '@/components/aa/ImportBackupForm'
import { isAaAuthEnabledClient } from '@/lib/auth/is-aa-auth-enabled'

export default function ImportWalletPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { status } = useSession()
  const aaEnabled = isAaAuthEnabledClient()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/wallet'

  useEffect(() => {
    if (aaEnabled && status === 'unauthenticated') {
      router.replace(`/login?callbackUrl=${encodeURIComponent('/import-wallet')}`)
    }
  }, [aaEnabled, status, router])

  if (!aaEnabled) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-gray-400">
        AA auth is not enabled.
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-gray-400">
        Loading…
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-gray-400">
        Redirecting to sign in…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-12">
      <div>
        <BackToDeCleanupLink />
        <h1 className="mt-2 font-heading text-2xl tracking-wider text-white sm:text-3xl">Restore wallet</h1>
        <p className="mt-2 text-sm text-gray-400">
          Recover on a new device or browser. Sign in with Google or email first, then upload your
          encrypted backup file.
        </p>
      </div>

      <ImportBackupForm redirectTo={callbackUrl} />
    </div>
  )
}
