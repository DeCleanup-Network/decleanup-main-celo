'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { isAaAuthEnabledClient } from '@/lib/auth/is-aa-auth-enabled'
import { safeCallbackUrl } from '@/lib/auth/safe-callback-url'
import { LoginOptions } from '@/components/auth/LoginOptions'

type Props = {
  emailLoginEnabled: boolean
}

export default function LoginPageClient({ emailLoginEnabled }: Props) {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = safeCallbackUrl(searchParams.get('callbackUrl'))
  const authError = searchParams.get('error')
  const emailSent = searchParams.get('email') === 'sent'
  const aaEnabled = isAaAuthEnabledClient()
  const errorMessage =
    authError === 'Configuration'
      ? 'Sign-in could not finish. The app could not save your account to Postgres. In frontend/: run npm run db:check. Fix DATABASE_URL (postgresql://…?sslmode=require), run npm run db:push, or paste prisma/supabase-full-schema.sql into Supabase SQL Editor. Then restart npm run dev.'
      : authError
        ? `Sign-in failed (${authError}). Check the terminal where npm run dev is running.`
        : null

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(callbackUrl)
    }
  }, [status, router, callbackUrl])

  if (!aaEnabled) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-white">AA auth not enabled</h1>
        <p className="mt-2 text-sm text-gray-400">
          Set <code className="text-brand-green">NEXT_PUBLIC_AA_AUTH_ENABLED=true</code> and configure Auth.js
          env vars (see ENV_TEMPLATE.md).
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-center text-2xl font-bold text-white">Sign in</h1>
      <p className="mt-2 text-center text-sm text-gray-400">
        Pick one way in. You can add the others later.
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

      <LoginOptions
        className="mt-8"
        callbackUrl={callbackUrl}
        emailLoginEnabled={emailLoginEnabled}
      />
    </div>
  )
}
