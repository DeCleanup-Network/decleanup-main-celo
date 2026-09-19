'use client'

import { signIn } from 'next-auth/react'
import { safeCallbackUrl } from '@/lib/auth/safe-callback-url'

type SignMessage = (args: { message: string }) => Promise<`0x${string}` | string>

/**
 * One-time SIWE-style sign-in for a connected external wallet.
 * Creates/updates Auth.js user (`@wallet.local`) so notification prefs & push work.
 */
export async function signInWithConnectedWallet(opts: {
  address: string
  signMessageAsync: SignMessage
  /** Where the app goes next. Without it Auth.js stores the current URL as the callback. */
  redirectTo?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const address = opts.address.trim()
  if (!address) return { ok: false, error: 'Wallet not connected' }

  try {
    const res = await fetch(
      `/api/auth/wallet/nonce?address=${encodeURIComponent(address)}`,
      { credentials: 'include' }
    )
    if (!res.ok) return { ok: false, error: 'Could not start wallet sign-in' }
    const { message } = (await res.json()) as { message: string }
    if (!message) return { ok: false, error: 'Missing sign-in message' }

    const signature = await opts.signMessageAsync({ message })
    const result = await signIn('wallet', {
      message,
      signature,
      redirect: false,
      callbackUrl: safeCallbackUrl(opts.redirectTo),
    })

    if (result?.error) {
      const hint =
        result.error === 'Configuration'
          ? 'Database or auth config issue — check DATABASE_URL and restart the app.'
          : result.error === 'CredentialsSignin'
            ? 'Signature or sign-in session expired. Try again.'
            : `Wallet sign-in failed (${result.error}).`
      return { ok: false, error: hint }
    }

    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Wallet sign-in failed' }
  }
}
