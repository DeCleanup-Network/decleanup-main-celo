'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { Button } from '@/components/ui/button'

type Props = {
  callbackUrl: string
}

function safeCallbackUrl(url: string): string {
  if (!url || url.startsWith('/login')) return '/'
  return url
}

/**
 * MetaMask / WalletConnect via RainbowKit modal (works in AA auth mode).
 */
export function ExternalWalletLogin({ callbackUrl }: Props) {
  const router = useRouter()
  const { status } = useSession()
  const { isConnected } = useAccount()
  const target = safeCallbackUrl(callbackUrl)
  const redirectedRef = useRef(false)

  useEffect(() => {
    if (!isConnected || redirectedRef.current) return
    redirectedRef.current = true
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

  useEffect(() => {
    if (!isConnected) redirectedRef.current = false
  }, [isConnected])

  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, mounted: rkMounted }) => {
        if (!rkMounted) {
          return (
            <Button type="button" disabled className="w-full" aria-busy="true">
              Connect wallet
            </Button>
          )
        }

        if (account && chain) {
          return (
            <p className="text-center text-xs text-brand-green">Connected — opening app…</p>
          )
        }

        return (
          <div className="space-y-2">
            <Button type="button" className="w-full font-plakat tracking-normal" onClick={openConnectModal}>
              Connect wallet
            </Button>
            <p className="text-center text-landing-hint">
              Choose MetaMask, WalletConnect, or another wallet in the modal.
            </p>
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}
