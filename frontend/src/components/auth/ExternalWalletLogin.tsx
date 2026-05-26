'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useAccount, useConnect } from 'wagmi'
import { Button } from '@/components/ui/button'

type Props = {
  callbackUrl: string
}

function safeCallbackUrl(url: string): string {
  if (!url || url.startsWith('/login')) return '/'
  return url
}

/**
 * MetaMask / browser wallet — same wagmi tree as the rest of the app (no nested RainbowKit provider).
 */
export function ExternalWalletLogin({ callbackUrl }: Props) {
  const router = useRouter()
  const { status } = useSession()
  const { isConnected } = useAccount()
  const { connect, connectors, isPending, error } = useConnect()
  const target = safeCallbackUrl(callbackUrl)

  useEffect(() => {
    if (!isConnected) return
    let cancelled = false
    void (async () => {
      if (status === 'authenticated') {
        await signOut({ redirect: false })
      }
      if (!cancelled) router.replace(target)
    })()
    return () => {
      cancelled = true
    }
  }, [isConnected, status, router, target])

  const preferred =
    connectors.find((c) => c.id === 'io.metamask') ??
    connectors.find((c) => c.id === 'injected') ??
    connectors[0]

  return (
    <div className="space-y-2">
      {isConnected ? (
        <p className="text-center text-xs text-brand-green">Connected — opening app…</p>
      ) : (
        <>
          <Button
            type="button"
            disabled={!preferred || isPending}
            className="w-full font-sans !text-black bg-brand-green hover:bg-brand-green/90 disabled:opacity-50"
            onClick={() => preferred && connect({ connector: preferred })}
          >
            {isPending ? 'Connecting…' : 'Connect wallet'}
          </Button>
          {error && (
            <p className="text-center text-xs text-amber-300" role="alert">
              {error.message}
            </p>
          )}
        </>
      )}
    </div>
  )
}
