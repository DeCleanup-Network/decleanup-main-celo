'use client'

import { useCallback, useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { useRouter } from 'next/navigation'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Button } from '@/components/ui/button'
import { signInWithConnectedWallet } from '@/lib/auth/client-wallet-signin'

type Props = {
  callbackUrl: string
}

export function WalletSignInButton({ callbackUrl }: Props) {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signInWithWallet = useCallback(async () => {
    if (!address) return
    setPending(true)
    setError(null)
    try {
      const result = await signInWithConnectedWallet({
        address,
        signMessageAsync,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.replace(callbackUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wallet sign-in failed')
    } finally {
      setPending(false)
    }
  }, [address, signMessageAsync, callbackUrl, router])

  return (
    <div className="space-y-2">
      <div className="flex justify-center [&_button]:!font-sans">
        <ConnectButton chainStatus="none" showBalance={false} />
      </div>
      {isConnected && address && (
        <Button
          type="button"
          variant="outline"
          className="w-full border-white/10 text-foreground"
          disabled={pending}
          onClick={() => void signInWithWallet()}
        >
          {pending ? 'Signing…' : 'Sign in with connected wallet'}
        </Button>
      )}
      {error && (
        <p className="text-center text-xs text-amber-300" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
