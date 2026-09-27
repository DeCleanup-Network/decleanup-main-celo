'use client'

import { useEffect, useState } from 'react'
import { getProviders, signIn } from 'next-auth/react'
import { ChevronDown } from 'lucide-react'
import { useDisconnect } from 'wagmi'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ExternalWalletLogin } from '@/components/auth/ExternalWalletLogin'
import { LoginEmailForm } from '@/components/auth/LoginEmailForm'
import { useExperienceChain } from '@/hooks/useExperienceChain'

type Props = {
  callbackUrl: string
  /** Known server side on /login; discovered from Auth.js providers elsewhere. */
  emailLoginEnabled?: boolean
  className?: string
}

/** Sign-in options: Google, email (expands for the address), or a wallet. */
export function LoginOptions({ callbackUrl, emailLoginEnabled, className }: Props) {
  const { disconnect } = useDisconnect()
  const { isRobinhood } = useExperienceChain()
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailEnabled, setEmailEnabled] = useState(emailLoginEnabled ?? false)
  const socialDisabled = isRobinhood

  useEffect(() => {
    if (emailLoginEnabled !== undefined) return
    let cancelled = false
    void getProviders()
      .then((providers) => {
        if (!cancelled) setEmailEnabled(Boolean(providers?.email))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [emailLoginEnabled])

  return (
    <div className={cn('space-y-2', className)}>
      {socialDisabled ? (
        <p className="text-center text-xs text-zinc-400">
          Robinhood demo uses a wallet. Google and email are off.
        </p>
      ) : null}

      <Button
        type="button"
        className="w-full"
        disabled={socialDisabled}
        aria-disabled={socialDisabled}
        onClick={() => {
          if (socialDisabled) return
          disconnect()
          void signIn('google', { callbackUrl })
        }}
      >
        Continue with Google
      </Button>

      {emailEnabled || socialDisabled ? (
        <div className="space-y-2">
          <Button
            type="button"
            className="w-full"
            disabled={socialDisabled}
            aria-disabled={socialDisabled}
            aria-expanded={emailOpen}
            aria-controls="login-email-panel"
            onClick={() => {
              if (socialDisabled) return
              setEmailOpen((value) => !value)
            }}
          >
            Continue with email
            <ChevronDown
              className={cn(
                'transition-transform motion-reduce:transition-none',
                emailOpen && 'rotate-180'
              )}
              aria-hidden
            />
          </Button>
          <div
            id="login-email-panel"
            hidden={!emailOpen || socialDisabled}
            className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-3"
          >
            <LoginEmailForm callbackUrl={callbackUrl} />
          </div>
        </div>
      ) : null}

      <ExternalWalletLogin callbackUrl={callbackUrl} />
    </div>
  )
}
