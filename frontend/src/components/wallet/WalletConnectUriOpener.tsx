'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { getConnectors } from '@wagmi/core'
import { useConfig } from 'wagmi'
import {
  getWalletConnectUri,
  setWalletConnectUri,
  subscribeWalletConnectUri,
} from '@/lib/blockchain/wallet-connect-uri'

type ConnectorMessage = {
  type: string
  data?: unknown
}

/**
 * Keeps the latest WalletConnect pairing URI around so connect buttons can offer a manual
 * deep link when the AppKit modal does not appear. Never navigates on its own: an automatic
 * redirect to walletconnect.com used to drop people out of the dApp mid-connect.
 */
export function WalletConnectUriOpener() {
  const config = useConfig()

  useEffect(() => {
    const walletConnect = getConnectors(config).find((c) => c.id === 'walletConnect')
    if (!walletConnect) return

    const onMessage = (message: ConnectorMessage) => {
      if (message.type !== 'display_uri' || typeof message.data !== 'string') return
      setWalletConnectUri(message.data)
    }

    const onConnect = () => setWalletConnectUri(null)

    walletConnect.emitter.on('message', onMessage)
    walletConnect.emitter.on('connect', onConnect)
    return () => {
      walletConnect.emitter.off('message', onMessage)
      walletConnect.emitter.off('connect', onConnect)
    }
  }, [config])

  return null
}

/** Latest WalletConnect pairing URI, or null when there is no pending pairing. */
export function useWalletConnectUri(): string | null {
  return useSyncExternalStore(
    subscribeWalletConnectUri,
    getWalletConnectUri,
    () => null
  )
}
