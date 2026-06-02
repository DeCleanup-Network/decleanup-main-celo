'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useDisconnect } from 'wagmi'
import { Button } from '@/components/ui/button'

const INPUT_ID = 'dcu-magic-link-contact'

type Props = {
  callbackUrl: string
}

export function LoginEmailForm({ callbackUrl }: Props) {
  const { disconnect } = useDisconnect()
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contactReadOnly, setContactReadOnly] = useState(true)

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
            ? 'Server misconfiguration (database or auth env). On Vercel set AUTH_SECRET, DATABASE_URL, DIRECT_URL, AUTH_URL, and RESEND_API_KEY — then redeploy.'
            : result.error === 'EmailSignin'
              ? 'Could not send email. With Resend test sender onboarding@resend.dev, use the same email as your Resend account. Check RESEND_API_KEY and EMAIL_FROM on Vercel.'
              : `Could not send sign-in link (${result.error}). Check RESEND_API_KEY (or EMAIL_SERVER) in env.`
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
    <form
      onSubmit={(e) => void submit(e)}
      className="space-y-2"
      autoComplete="off"
      data-1p-ignore="true"
      data-lpignore="true"
    >
      <label className="block text-left text-xs text-gray-500" htmlFor={INPUT_ID}>
        Email (magic link)
      </label>
      <input
        id={INPUT_ID}
        name="dcu-magic-link-contact"
        type="text"
        inputMode="email"
        enterKeyHint="send"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        readOnly={contactReadOnly}
        placeholder="you@example.com"
        value={email}
        onFocus={() => setContactReadOnly(false)}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-600"
        data-1p-ignore="true"
        data-lpignore="true"
        data-form-type="other"
        aria-label="Email for magic link sign-in"
      />
      <Button
        type="submit"
        variant="brandGhost"
        className="w-full border-white/10 text-foreground"
        disabled={pending || sent}
      >
        {sent ? 'Check your inbox' : pending ? 'Sending…' : 'Continue with Email'}
      </Button>
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
