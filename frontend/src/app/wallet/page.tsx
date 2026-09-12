'use client'

import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { BackToDeCleanupLink } from '@/components/layout/BackToDeCleanupLink'
import { Button } from '@/components/ui/button'
import { WalletStatusCard } from '@/components/aa/WalletStatusCard'
import { PendingPasswordSettings } from '@/components/aa/PendingPasswordSettings'
import { UnlockSigningForm } from '@/components/aa/UnlockSigningForm'
import { WalletSessionBar } from '@/components/aa/WalletSessionBar'
import { useAaWallet } from '@/hooks/useAaWallet'
import { useAccount } from 'wagmi'
import { useSignOutAll } from '@/hooks/useSignOutAll'
import { useEmbeddedAuth } from '@/hooks/useEmbeddedAuth'
import { isAaAuthEnabledClient } from '@/lib/auth/is-aa-auth-enabled'

const PasskeySettings = dynamic(
  () => import('@/components/aa/PasskeySettings').then((m) => ({ default: m.PasskeySettings })),
  { ssr: false, loading: () => <div className="h-24 animate-pulse rounded-xl bg-gray-900/50" /> }
)

const MetamaskExportSection = dynamic(
  () =>
    import('@/components/aa/MetamaskExportSection').then((m) => ({ default: m.MetamaskExportSection })),
  { ssr: false, loading: () => <div className="h-16 animate-pulse rounded-xl bg-gray-900/50" /> }
)

const PushNotificationSettings = dynamic(
  () =>
    import('@/components/notifications/PushNotificationSettings').then((m) => ({
      default: m.PushNotificationSettings,
    })),
  { ssr: false, loading: () => <div className="h-24 animate-pulse rounded-xl bg-gray-900/50" /> }
)

export default function AccountSettingsPage() {
  const { status } = useSession()
  const router = useRouter()
  const aaEnabled = isAaAuthEnabledClient()
  const { wallet, loading, error, phase, lock } = useAaWallet()
  const { isEmbeddedAccount } = useEmbeddedAuth()
  const { isConnected: wagmiConnected } = useAccount()
  const { signOutAll, disconnecting: signingOut } = useSignOutAll()

  useEffect(() => {
    if (!aaEnabled) return
    if (!isEmbeddedAccount) {
      router.replace(wagmiConnected ? '/wallet/external' : '/login?callbackUrl=/wallet')
      return
    }
    if (status === 'unauthenticated') {
      router.replace('/login?callbackUrl=/wallet')
    }
  }, [aaEnabled, isEmbeddedAccount, wagmiConnected, status, router])

  if (!aaEnabled) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center text-gray-400">
        Account settings are not enabled.
      </div>
    )
  }

  if (status === 'loading' || phase === 'loading') {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center text-gray-400">
        Loading account…
      </div>
    )
  }

  const showWalletDetails =
    phase === 'unlocked' || phase === 'locked' || phase === 'pending-password'

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <header className="space-y-3 border-b border-gray-800 pb-5">
        <BackToDeCleanupLink />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-heading text-2xl tracking-wider text-white sm:text-3xl">Account settings</h1>
          <div className="flex flex-wrap gap-2">
            {phase === 'unlocked' && (
              <Button
                variant="outline"
                size="sm"
                className="border-white/10 text-muted-foreground"
                onClick={() => lock()}
              >
                Lock
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 text-muted-foreground"
              disabled={signingOut}
              onClick={() => void signOutAll({ callbackUrl: '/login' })}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Button>
          </div>
        </div>
      </header>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {phase === 'server-only' && (
        <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-200">
          Your wallet is linked to this account, but encrypted wallet data is missing from this device.
          Email support@decleanup.net from your sign-in address so the team can help.
        </div>
      )}

      {phase === 'no-wallet' && (
        <p className="text-sm text-gray-400">Setting up your wallet…</p>
      )}

      {showWalletDetails && (
        <>
          {phase === 'pending-password' && <PendingPasswordSettings />}

          <section className="space-y-3">
            <h2 className="font-heading text-sm tracking-wider text-gray-400">Your account</h2>
            <WalletStatusCard wallet={wallet} loading={loading} />
          </section>

          {phase === 'unlocked' && <WalletSessionBar />}
          {phase === 'locked' && <UnlockSigningForm />}

          {phase !== 'pending-password' && <PasskeySettings />}
          {(phase === 'locked' || phase === 'unlocked') && <MetamaskExportSection />}
        </>
      )}

      {/* Always visible when signed in — not gated on wallet unlock phase */}
      {status === 'authenticated' && <PushNotificationSettings />}
    </div>
  )
}
