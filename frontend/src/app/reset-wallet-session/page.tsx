'use client'

import { useEffect, useRef } from 'react'
import { useWeb3AuthDisconnect } from '@web3auth/modal/react'
import { clearWeb3AuthStorageAndRedirect } from '@/lib/web3auth/storage'
import { isWeb3AuthEnabled } from '@/lib/web3auth/config'

/**
 * When Web3Auth: calls logout(cleanup: true) first so cached adapter/chain is cleared, then clears storage.
 * Use when you see wrong chain (e.g. 11138620) or "aes/gcm: invalid ghash tag". Open: /reset-wallet-session
 */
function ResetWalletSessionWeb3Auth() {
  const done = useRef(false)
  const { disconnect } = useWeb3AuthDisconnect()

  useEffect(() => {
    if (done.current) return
    done.current = true
    ;(async () => {
      try {
        await disconnect({ cleanup: true })
      } catch {
        // ignore
      }
      clearWeb3AuthStorageAndRedirect('/')
    })()
  }, [disconnect])

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4">
      <p className="text-gray-400">Clearing session and redirecting…</p>
    </div>
  )
}

function ResetWalletSessionFallback() {
  useEffect(() => {
    clearWeb3AuthStorageAndRedirect('/')
  }, [])
  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4">
      <p className="text-gray-400">Clearing session and redirecting…</p>
    </div>
  )
}

export default function ResetWalletSessionPage() {
  if (isWeb3AuthEnabled) return <ResetWalletSessionWeb3Auth />
  return <ResetWalletSessionFallback />
}
