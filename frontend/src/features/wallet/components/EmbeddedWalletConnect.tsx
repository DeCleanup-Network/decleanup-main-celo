'use client'

import { useWeb3AuthConnect, useSwitchChain as useWeb3AuthSwitchChain } from '@web3auth/modal/react'
import { useAccount, useDisconnect } from 'wagmi'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { REQUIRED_CHAIN_ID, REQUIRED_CHAIN_ID_HEX } from '@/lib/blockchain/chain-constants'
import { isWeb3AuthPopupClosedError } from '@/lib/web3auth/errors'
import { clearWeb3AuthStorageAndReload } from '@/lib/web3auth/storage'

/**
 * Connect button for Web3Auth Embedded Wallets (social / email login).
 * Single "Log In" opens the Web3Auth modal (Google, email, etc.).
 * After connect we auto-try switching to Celo Sepolia once via Web3Auth's switchChain (embedded wallet often starts on wrong chain).
 */
export function EmbeddedWalletConnect() {
  const [mounted, setMounted] = useState(false)
  const [dismissMessage, setDismissMessage] = useState<string | null>(null)
  const { connect, loading, isConnected, error } = useWeb3AuthConnect()
  const { address, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { switchChain: web3AuthSwitchChain } = useWeb3AuthSwitchChain()
  const didAutoSwitch = useRef(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // One-time auto-switch to Celo Sepolia after connect (embedded wallet may report wrong chain from cache)
  useEffect(() => {
    if (!isConnected || !address || chainId === undefined || chainId === REQUIRED_CHAIN_ID) return
    if (didAutoSwitch.current) return
    didAutoSwitch.current = true
    web3AuthSwitchChain(REQUIRED_CHAIN_ID_HEX).catch(() => {
      // Ignore; user will see wrong-network banner and can use "Reset session"
    })
  }, [isConnected, address, chainId, web3AuthSwitchChain])

  if (!mounted) {
    return (
      <div className="flex h-9 w-32 animate-pulse items-center justify-center rounded-lg bg-gray-800" />
    )
  }

  if (!isConnected || !address) {
    const errorMessage = error?.message ?? null
    const isPopupErr =
      dismissMessage != null || (error != null && isWeb3AuthPopupClosedError(error))
    const displayText =
      dismissMessage ??
      (errorMessage && isWeb3AuthPopupClosedError(error)
        ? 'Login window closed before finishing. Click Log In to try again.'
        : errorMessage)
    const isAuthError =
      !isPopupErr &&
      (errorMessage?.toLowerCase().includes('failed to login with auth') ||
        errorMessage?.toLowerCase().includes('failed to connect with wallet') ||
        errorMessage?.toLowerCase().includes('wallet is not found'))

    const handleConnect = () => {
      setDismissMessage(null)
      try {
        const result = connect()
        void Promise.resolve(result).catch((e: unknown) => {
          if (isWeb3AuthPopupClosedError(e)) {
            setDismissMessage('Login window closed before finishing. Click Log In to try again.')
          }
        })
      } catch (e: unknown) {
        if (isWeb3AuthPopupClosedError(e)) {
          setDismissMessage('Login window closed before finishing. Click Log In to try again.')
        }
      }
    }

    return (
      <div className="flex flex-col items-center gap-1">
        <Button
          onClick={handleConnect}
          disabled={loading}
          className="bg-brand-green text-black hover:bg-brand-green/90"
        >
          {loading ? 'Connecting...' : 'Log In'}
        </Button>
        {displayText && (
          <div className="flex max-w-[240px] flex-col items-center gap-1 text-center">
            <p
              className={`text-xs ${isPopupErr ? 'text-amber-400/90' : 'text-red-400'}`}
              title={displayText}
            >
              {displayText}
            </p>
            {isAuthError && (
              <a
                href="/reset-wallet-session"
                className="text-xs text-gray-500 underline hover:text-gray-400"
              >
                Reset session & try again
              </a>
            )}
          </div>
        )}
      </div>
    )
  }

  const shortAddress = `${address.slice(0, 6)}…${address.slice(-4)}`
  const isWrongChain = chainId !== undefined && chainId !== REQUIRED_CHAIN_ID

  return (
    <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-gray-300">{shortAddress}</span>
        {isWrongChain && (
          <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-xs text-yellow-400">
            Wrong network
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          className="border-gray-600 text-gray-300 hover:bg-gray-800"
          onClick={() => disconnect()}
        >
          Disconnect
        </Button>
      </div>
      <button
        type="button"
        onClick={clearWeb3AuthStorageAndReload}
        className="text-xs text-gray-500 underline hover:text-gray-400"
      >
        Having trouble? Reset session
      </button>
    </div>
  )
}
