'use client'

import { usePrivy, useLogin, useLogout } from '@privy-io/react-auth'
import { useAccount, useDisconnect } from 'wagmi'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CopyableAddress } from '@/components/ui/copyable-address'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'

function PreparingLoginButton() {
  return (
    <Button
      type="button"
      disabled
      aria-busy="true"
      aria-label="Preparing login"
      className="min-w-[8.75rem] font-sans !text-black bg-brand-green hover:bg-brand-green/90 disabled:!opacity-100 disabled:bg-brand-green/65 disabled:!text-black"
    >
      Preparing login…
    </Button>
  )
}

/**
 * Connect button for Privy Embedded Wallets (social / email login).
 * Single "Log In" opens the Privy modal (Google, email, etc.).
 */
export function EmbeddedWalletConnect() {
  const [mounted, setMounted] = useState(false)
  const { ready, authenticated, user } = usePrivy()
  const { login } = useLogin()
  const { logout } = useLogout()
  const { address, chainId } = useAccount()
  const { disconnect } = useDisconnect()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !ready) {
    return <PreparingLoginButton />
  }

  const isConnected = authenticated && !!address

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center gap-2">
        <Button
          onClick={() => login()}
          className="font-sans !text-black bg-brand-green hover:bg-brand-green/90"
        >
          Log In
        </Button>
      </div>
    )
  }

  const isWrongChain = chainId !== undefined && chainId !== REQUIRED_CHAIN_ID

  return (
    <div className="flex max-w-[min(100vw-4.5rem,20rem)] flex-col items-end gap-1 text-right sm:max-w-none">
      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
        <CopyableAddress
          address={address}
          className="text-[11px] text-gray-300 sm:text-sm"
        />
        {isWrongChain && (
          <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] text-yellow-400 sm:text-xs">
            Wrong network
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0 border-gray-600 px-2.5 text-[11px] text-gray-300 hover:bg-gray-800 sm:h-9 sm:text-sm"
          onClick={() => {
            logout()
            disconnect()
          }}
        >
          Disconnect
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-x-2.5 gap-y-0.5 sm:gap-x-3">
        <span className="text-[11px] text-gray-500 sm:text-xs">
          Logged in via {user?.linkedAccounts?.[0]?.type || 'social'}
        </span>
      </div>
    </div>
  )
}
