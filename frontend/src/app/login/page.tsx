'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { useDisconnect } from 'wagmi'
import { Button } from '@/components/ui/button'
import { isAaAuthEnabledClient } from '@/lib/auth/is-aa-auth-enabled'
import { useEmbeddedAuth } from '@/hooks/useEmbeddedAuth'
import { ExternalWalletLogin } from '@/components/auth/ExternalWalletLogin'
import { LoginEmailForm } from '@/components/auth/LoginEmailForm'
import { LoginRecoverySection } from '@/components/auth/LoginRecoverySection'

function LoginDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-gray-700" />
      <span className="text-[10px] uppercase tracking-wide text-gray-500">{label}</span>
      <div className="h-px flex-1 bg-gray-700" />
    </div>
  )
}

export default function LoginPage() {
  const { status } = useSession()
  const { isEmbeddedAccount } = useEmbeddedAuth()
  const { disconnect } = useDisconnect()
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/'
  const authError = searchParams.get('error')
  const emailSent = searchParams.get('email') === 'sent'
  const aaEnabled = isAaAuthEnabledClient()
  const errorMessage =
    authError === 'Configuration'
      ? 'Sign-in could not finish — the app could not save your account to Postgres. In frontend/: run npm run db:check. Fix DATABASE_URL (postgresql://…?sslmode=require), run npm run db:push, or paste prisma/supabase-auth-tables.sql into Supabase SQL Editor. Then restart npm run dev.'
      : authError
        ? `Sign-in failed (${authError}). Check the terminal where npm run dev is running.`
        : null

  useEffect(() => {
    if (status === 'authenticated' && isEmbeddedAccount) {
      router.replace(callbackUrl)
    }
  }, [status, isEmbeddedAccount, router, callbackUrl])

  if (!aaEnabled) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-white">AA auth not enabled</h1>
        <p className="mt-2 text-sm text-gray-400">
          Set <code className="text-brand-green">NEXT_PUBLIC_AA_AUTH_ENABLED=true</code> and configure Auth.js
          env vars (see <code>.env.aa.example</code>).
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-center text-2xl font-bold text-white">Sign in</h1>
      <p className="mt-2 text-center text-sm text-gray-400">
        Google · Email · MetaMask · Recovery import
      </p>

      {(errorMessage || emailSent) && (
        <p
          className={`mt-6 rounded-lg border px-3 py-2 text-left text-xs ${
            emailSent
              ? 'border-brand-green/40 bg-brand-green/10 text-brand-green'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
          }`}
          role="alert"
        >
          {emailSent
            ? 'Check your email for the sign-in link, then return here.'
            : errorMessage}
        </p>
      )}

      <div className="mt-8 space-y-4">
        <Button
          type="button"
          className="w-full font-sans !text-black bg-brand-green hover:bg-brand-green/90"
          onClick={() => {
            disconnect()
            void signIn('google', { callbackUrl })
          }}
        >
          Continue with Google
        </Button>

        <LoginDivider label="or" />

        <LoginEmailForm callbackUrl={callbackUrl} />

        <LoginDivider label="or" />

        <div>
          <p className="mb-2 text-center text-xs text-gray-500">Or connect MetaMask</p>
          <ExternalWalletLogin callbackUrl={callbackUrl} />
        </div>

        <LoginRecoverySection callbackUrl={callbackUrl} />
      </div>

      <p className="mt-6 text-center text-[10px] leading-relaxed text-gray-600">
        Google or email → embedded smart wallet (gasless on Celo Sepolia). MetaMask → your own wallet and
        gas. Use one sign-in method at a time.
      </p>
    </div>
  )
}
