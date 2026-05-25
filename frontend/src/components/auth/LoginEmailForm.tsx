'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useDisconnect } from 'wagmi'
import { Button } from '@/components/ui/button'

type Props = {
  callbackUrl: string
}

export function LoginEmailForm({ callbackUrl }: Props) {
  const { disconnect } = useDisconnect()
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed.includes('@')) {
      setError('Enter a valid email address')
      return
    }
    setPending(true)
    setError(null)
    disconnect()
    try {
      const result = await signIn('email', {
        email: trimmed,
        callbackUrl,
        redirect: false,
      })
      if (result?.error) {
        const hint =
          result.error === 'Configuration'
            ? 'Email or database not configured — check EMAIL_SERVER, DATABASE_URL, then npm run db:check.'
            : result.error === 'EmailSignin'
              ? 'Could not send email. Use your Resend account email while testing onboarding@resend.dev.'
              : `Could not send sign-in link (${result.error}). Check EMAIL_SERVER in .env.local.`
        setError(hint)
        return
      }
      setSent(true)
    } catch {
      setError('Could not send sign-in link')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-2">
      <label className="block text-left text-xs text-gray-500" htmlFor="login-email">
        Email (magic link)
      </label>
      <input
        id="login-email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-600"
      />
      <Button
        type="submit"
        variant="outline"
        className="w-full border-gray-600 text-gray-200"
        disabled={pending || sent}
      >
        {sent ? 'Check your inbox' : pending ? 'Sending…' : 'Continue with Email'}
      </Button>
      <p className="text-left text-[10px] text-gray-600">
        Requires <code className="text-gray-500">EMAIL_SERVER</code> and{' '}
        <code className="text-gray-500">EMAIL_FROM</code> in .env.local (see .env.aa.example). With{' '}
        <code className="text-gray-500">onboarding@resend.dev</code>, only your Resend account inbox receives mail.
      </p>
      {error && (
        <p className="text-xs text-amber-300" role="alert">
          {error}
        </p>
      )}
      {sent && (
        <p className="text-xs text-brand-green">
          We sent a sign-in link to {email}. Open it on this device to finish login.
        </p>
      )}
    </form>
  )
}
