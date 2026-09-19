'use client'

import { useEffect, useState } from 'react'
import { getProviders, signIn } from 'next-auth/react'
import { ChevronDown } from 'lucide-react'
import { useDisconnect } from 'wagmi'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ExternalWalletLogin } from '@/components/auth/ExternalWalletLogin'
import { LoginEmailForm } from '@/components/auth/LoginEmailForm'

type Props = {
  callbackUrl: string
  /** Known server side on /login; discovered from Auth.js providers elsewhere. */
  emailLoginEnabled?: boolean
  className?: string
}

/** Sign-in options: Google, email (expands for the address), or a wallet. */
export function LoginOptions({ callbackUrl, emailLoginEnabled, className }: Props) {
  const { disconnect } = useDisconnect()
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailEnabled, setEmailEnabled] = useState(emailLoginEnabled ?? false)

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
      <Button
        type="button"
        className="w-full"
        onClick={() => {
          disconnect()
          void signIn('google', { callbackUrl })
        }}
      >
        Continue with Google
      </Button>

      {emailEnabled ? (
        <div className="space-y-2">
          <Button
            type="button"
            className="w-full"
            aria-expanded={emailOpen}
            aria-controls="login-email-panel"
            onClick={() => setEmailOpen((value) => !value)}
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
            hidden={!emailOpen}
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
