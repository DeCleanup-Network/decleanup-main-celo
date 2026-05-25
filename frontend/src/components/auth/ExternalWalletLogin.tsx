'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'

type Props = {
  callbackUrl: string
}

/**
 * MetaMask / RainbowKit only — no Auth.js session, no embedded smart account.
 */
export function ExternalWalletLogin({ callbackUrl }: Props) {
  const router = useRouter()
  const { isConnected } = useAccount()

  useEffect(() => {
    if (!isConnected) return
    let cancelled = false
    void (async () => {
      await signOut({ redirect: false })
      if (!cancelled) router.replace(callbackUrl)
    })()
    return () => {
      cancelled = true
    }
  }, [isConnected, callbackUrl, router])

  return (
    <div className="space-y-2">
      <p className="text-center text-xs leading-relaxed text-gray-500">
        Connect MetaMask or another browser wallet. You use your own address and pay gas on Celo — no
        embedded smart account.
      </p>
      <div className="flex justify-center [&_button]:!font-sans">
        <ConnectButton chainStatus="icon" showBalance={false} />
      </div>
      {isConnected && (
        <p className="text-center text-xs text-brand-green">Connected — opening app…</p>
      )}
    </div>
  )
}
