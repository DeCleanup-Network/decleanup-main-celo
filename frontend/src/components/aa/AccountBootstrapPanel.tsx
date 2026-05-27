'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type AccountBootstrapPanelProps = {
  /** Signing in with Google or email */
  stage?: 'auth' | 'wallet'
  error?: string | null
  onRetry?: () => void
}

export function AccountBootstrapPanel({ stage = 'wallet', error, onRetry }: AccountBootstrapPanelProps) {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (error || stage === 'auth') return
    const id = window.setTimeout(() => setSlow(true), 25_000)
    return () => window.clearTimeout(id)
  }, [error, stage])

  const title =
    stage === 'auth' ? 'Signing you in' : 'Connecting your smart account'
  const detail =
    stage === 'auth'
      ? 'Connecting your Google account to DeCleanup Rewards.'
      : slow && !error
        ? 'This is taking longer than usual (network or RPC). You can wait or try again.'
        : 'Setting up your DeCleanup Rewards smart account on this device. This usually takes a few seconds.'

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        {!error ? (
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-brand-green" aria-hidden />
        ) : null}
        <h1 className="font-bebas text-2xl tracking-wider text-foreground">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{error ?? detail}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {onRetry ? (
            <Button
              type="button"
              variant="outline"
              className="border-gray-600 text-gray-200"
              onClick={onRetry}
            >
              Try again
            </Button>
          ) : null}
          {error || slow ? (
            <Button asChild className="bg-brand-green text-black hover:bg-brand-green/90">
              <Link href="/wallet">Smart account settings</Link>
            </Button>
          ) : null}
        </div>
        {!error && !slow ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Submit cleanup will unlock when your account is ready.
          </p>
        ) : null}
      </div>
    </div>
  )
}
