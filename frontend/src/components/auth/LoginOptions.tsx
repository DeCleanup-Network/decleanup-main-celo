'use client'

import { useEffect, useState } from 'react'
import { getProviders, signIn } from 'next-auth/react'
import { ChevronDown, Mail, Wallet } from 'lucide-react'
import { useDisconnect } from 'wagmi'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ExternalWalletLogin } from '@/components/auth/ExternalWalletLogin'
import { LoginEmailForm } from '@/components/auth/LoginEmailForm'

type Section = 'email' | 'wallet'

type RowProps = {
  id: string
  label: string
  icon: React.ReactNode
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}

function LoginOptionRow({ id, label, icon, open, onToggle, children }: RowProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border transition-colors',
        open ? 'border-brand-green/40 bg-brand-green/[0.04]' : 'border-white/10 bg-white/[0.02]'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className="flex min-h-[48px] w-full items-center justify-between gap-3 px-4 py-2.5 text-left font-heading text-sm font-semibold uppercase tracking-wide text-foreground transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-green/30"
      >
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground" aria-hidden>
            {icon}
          </span>
          {label}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
            open && 'rotate-180'
          )}
          aria-hidden
        />
      </button>
      <div id={`${id}-panel`} hidden={!open} className="border-t border-white/10 px-4 py-3">
        {children}
      </div>
    </div>
  )
}

type Props = {
  callbackUrl: string
  /** Known server side on /login; discovered from Auth.js providers elsewhere. */
  emailLoginEnabled?: boolean
  className?: string
}

/** Sign-in options that expand in place: Google, email magic link, or wallet. */
export function LoginOptions({ callbackUrl, emailLoginEnabled, className }: Props) {
  const { disconnect } = useDisconnect()
  const [open, setOpen] = useState<Section | null>(null)
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

  const toggle = (section: Section) => setOpen((current) => (current === section ? null : section))

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
        <LoginOptionRow
          id="login-email"
          label="Continue with email"
          icon={<Mail className="h-4 w-4" />}
          open={open === 'email'}
          onToggle={() => toggle('email')}
        >
          <LoginEmailForm callbackUrl={callbackUrl} />
        </LoginOptionRow>
      ) : null}

      <LoginOptionRow
        id="login-wallet"
        label="Connect wallet"
        icon={<Wallet className="h-4 w-4" />}
        open={open === 'wallet'}
        onToggle={() => toggle('wallet')}
      >
        <ExternalWalletLogin callbackUrl={callbackUrl} />
      </LoginOptionRow>
    </div>
  )
}
