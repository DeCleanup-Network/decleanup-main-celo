'use client'

import {
  useWeb3Auth,
  useWeb3AuthConnect,
  useSwitchChain as useWeb3AuthSwitchChain,
} from '@web3auth/modal/react'
import { CONNECTOR_STATUS } from '@web3auth/modal'
import { useAccount, useDisconnect } from 'wagmi'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CopyableAddress } from '@/components/ui/copyable-address'
import { REQUIRED_CHAIN_ID, REQUIRED_CHAIN_ID_HEX } from '@/lib/blockchain/chain-constants'
import { isWeb3AuthModalNotReadyError, isWeb3AuthPopupClosedError } from '@/lib/web3auth/errors'
import { clearWeb3AuthStorageAndReload } from '@/lib/web3auth/storage'
import { WEB3AUTH_ACCOUNT_DASHBOARD_URL, WEB3AUTH_DEVELOPER_DASHBOARD_URL } from '@/lib/web3auth/urls'

/**
 * If init hangs (common when signer returns 403 for Wallet Services), show help instead of endless spinner.
 * Keep this fairly short so operators notice quickly.
 */
const WEB3AUTH_INIT_STALL_MS = 8_000

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
 * Connect button for Web3Auth Embedded Wallets (social / email login).
 * Single "Log In" opens the Web3Auth modal (Google, email, etc.).
 * After connect we auto-try switching to Celo Sepolia once via Web3Auth's switchChain (embedded wallet often starts on wrong chain).
 */
export function EmbeddedWalletConnect() {
  const [mounted, setMounted] = useState(false)
  const [initSlow, setInitSlow] = useState(false)
  const [dismissMessage, setDismissMessage] = useState<string | null>(null)
  const { isInitialized, isInitializing, initError, status } = useWeb3Auth()
  const { connect, loading, isConnected, error } = useWeb3AuthConnect()
  const { address, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { switchChain: web3AuthSwitchChain } = useWeb3AuthSwitchChain()
  const didAutoSwitch = useRef(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const authNotReady = !isInitialized || isInitializing
  const waitingForWeb3AuthInit =
    mounted && authNotReady && (!isConnected || !address)

  useEffect(() => {
    if (!waitingForWeb3AuthInit) {
      setInitSlow(false)
      return
    }
    const id = window.setTimeout(() => setInitSlow(true), WEB3AUTH_INIT_STALL_MS)
    return () => window.clearTimeout(id)
  }, [waitingForWeb3AuthInit])

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
    return <PreparingLoginButton />
  }

  // Logged-in users: never block on Web3Auth init (avoids hiding address after refresh).
  if (authNotReady && (!isConnected || !address)) {
    const initErrMsg = initError instanceof Error ? initError.message : initError != null ? String(initError) : null
    if (initErrMsg) {
      return (
        <div className="flex max-w-[min(100%,280px)] flex-col items-center gap-2 text-center">
          <p className="text-xs text-red-400" title={initErrMsg}>
            {initErrMsg}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-200"
              onClick={() => window.location.reload()}
            >
              Reload
            </Button>
            <a href="/reset-wallet-session" className="text-xs text-gray-500 underline hover:text-gray-400">
              Reset session
            </a>
          </div>
        </div>
      )
    }

    const stalled = initSlow || status === CONNECTOR_STATUS.ERRORED
    if (stalled) {
      return (
        <div className="flex max-w-[min(100%,min(100vw-2rem,380px))] flex-col items-center gap-3 text-center">
          <p className="text-xs font-medium text-amber-300/95">
            Login can’t finish loading
          </p>
          <p className="text-[11px] leading-snug text-gray-400">
            Social login needs{' '}
            <strong className="text-gray-300">Web3Auth Wallet Services</strong>. If the console shows{' '}
            <code className="rounded bg-white/5 px-1 py-0.5 text-[10px] text-amber-200/90">403</code> on{' '}
            <code className="rounded bg-white/5 px-1 py-0.5 text-[10px]">feature-access</code>, open your
            project in the{' '}
            <a
              href={WEB3AUTH_DEVELOPER_DASHBOARD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-green underline underline-offset-2 hover:text-brand-green/90"
            >
              Web3Auth dashboard
            </a>{' '}
            and enable Wallet Services or upgrade the plan. Ad blockers can also block the signer.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-gray-600 font-sans text-gray-200"
              onClick={() => window.location.reload()}
            >
              Reload page
            </Button>
            <a
              href="/reset-wallet-session"
              className="text-xs font-medium text-brand-green underline underline-offset-2 hover:text-brand-green/90"
            >
              Reset session
            </a>
          </div>
        </div>
      )
    }
    return <PreparingLoginButton />
  }

  if (!isConnected || !address) {
    const initErrMsg = initError instanceof Error ? initError.message : initError != null ? String(initError) : null
    const errorMessage = error?.message ?? null
    const isModalNotReadyErr =
      (error != null && isWeb3AuthModalNotReadyError(error)) ||
      (errorMessage != null && isWeb3AuthModalNotReadyError({ message: errorMessage }))
    const isPopupErr =
      dismissMessage != null ||
      (error != null && isWeb3AuthPopupClosedError(error)) ||
      isModalNotReadyErr
    const displayText =
      dismissMessage ??
      (initErrMsg && !errorMessage
        ? initErrMsg
        : errorMessage && isWeb3AuthPopupClosedError(error)
          ? 'Login window closed before finishing. Click Log In to try again.'
          : errorMessage && isModalNotReadyErr
            ? 'Login is still starting. Wait a second, then tap Log In again.'
            : errorMessage)
    const isAuthError =
      !isPopupErr &&
      (errorMessage?.toLowerCase().includes('failed to login with auth') ||
        errorMessage?.toLowerCase().includes('failed to connect with wallet') ||
        errorMessage?.toLowerCase().includes('wallet is not found'))

    const handleConnect = () => {
      if (!isInitialized || isInitializing) return
      setDismissMessage(null)
      try {
        const result = connect()
        void Promise.resolve(result).catch((e: unknown) => {
          if (isWeb3AuthPopupClosedError(e)) {
            setDismissMessage('Login window closed before finishing. Click Log In to try again.')
          } else if (isWeb3AuthModalNotReadyError(e)) {
            setDismissMessage('Login is still starting. Wait a second, then tap Log In again.')
          }
        })
      } catch (e: unknown) {
        if (isWeb3AuthPopupClosedError(e)) {
          setDismissMessage('Login window closed before finishing. Click Log In to try again.')
        } else if (isWeb3AuthModalNotReadyError(e)) {
          setDismissMessage('Login is still starting. Wait a second, then tap Log In again.')
        }
      }
    }

    return (
      <div className="flex flex-col items-center gap-1">
        <Button
          onClick={handleConnect}
          disabled={loading || !isInitialized || isInitializing}
          className="font-sans !text-black bg-brand-green hover:bg-brand-green/90"
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
          onClick={() => disconnect()}
        >
          Disconnect
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-x-2.5 gap-y-0.5 sm:gap-x-3">
        <a
          href={WEB3AUTH_ACCOUNT_DASHBOARD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-medium text-brand-green/90 underline-offset-2 hover:text-brand-green hover:underline sm:text-xs"
        >
          Manage wallet
        </a>
        <button
          type="button"
          onClick={clearWeb3AuthStorageAndReload}
          className="text-[11px] text-gray-500 underline hover:text-gray-400 sm:text-xs"
        >
          <span className="hidden sm:inline">Having trouble? </span>Reset session
        </button>
      </div>
    </div>
  )
}
