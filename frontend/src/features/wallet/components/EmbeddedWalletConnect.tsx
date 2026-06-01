'use client'

import { usePrivy, useLogin, useLogout } from '@privy-io/react-auth'
import { useAccount, useDisconnect } from 'wagmi'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CopyableAddress } from '@/components/ui/copyable-address'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'

function PreparingLoginButton() {
  return (
    <Button type="button" disabled aria-busy="true" aria-label="Preparing login" className="min-w-[8.75rem]">
      Preparing login…
    </Button>
  )
}

/**
 * Connect button for Privy Embedded Wallets (social / email login).
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
        <Button onClick={() => login()} className="min-w-[8.75rem] font-plakat tracking-normal">
          Log In
        </Button>
      </div>
    )
  }

  const isWrongChain = chainId !== undefined && chainId !== REQUIRED_CHAIN_ID

  return (
    <div className="flex max-w-[min(100vw-4.5rem,20rem)] flex-col items-end gap-1 text-right sm:max-w-none">
      <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
        <CopyableAddress address={address} className="text-[11px] text-muted-foreground sm:text-sm" />
        {isWrongChain && (
          <span className="rounded border border-brand-yellow/40 bg-brand-yellow/10 px-1.5 py-0.5 text-[10px] text-brand-yellow sm:text-xs">
            Wrong network
          </span>
        )}
        <Button
          variant="brandGhost"
          size="sm"
          className="h-8 shrink-0 px-2.5 text-[11px] sm:h-9 sm:text-sm"
          onClick={() => {
            logout()
            disconnect()
          }}
        >
          Disconnect
        </Button>
      </div>
      <span className="text-[11px] text-muted-foreground sm:text-xs">
        Logged in via {user?.linkedAccounts?.[0]?.type || 'social'}
      </span>
    </div>
  )
}
