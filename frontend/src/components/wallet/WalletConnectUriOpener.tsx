'use client'

import { useEffect } from 'react'
import { getConnectors } from '@wagmi/core'
import { useConfig } from 'wagmi'
import { isMobileBrowser } from '@/lib/blockchain/mobile-browser'
import { openWalletConnectMobileLink } from '@/lib/blockchain/wallet-connect-mobile-link'

function hasWalletConnectModalOpen(): boolean {
  return Boolean(
    document.querySelector('w3m-modal, wcm-modal, appkit-modal, [data-w3m-modal]')
  )
}

type ConnectorMessage = {
  type: string
  data?: unknown
}

/**
 * Fallback when AppKit modal fails to appear on mobile Safari — deep-link via WC universal URL.
 */
export function WalletConnectUriOpener() {
  const config = useConfig()

  useEffect(() => {
    if (!isMobileBrowser()) return

    const walletConnect = getConnectors(config).find((c) => c.id === 'walletConnect')
    if (!walletConnect) return

    const onMessage = (message: ConnectorMessage) => {
      if (message.type !== 'display_uri' || typeof message.data !== 'string') return

      window.setTimeout(() => {
        if (hasWalletConnectModalOpen()) return
        openWalletConnectMobileLink(message.data as string)
      }, 1200)
    }

    walletConnect.emitter.on('message', onMessage)
    return () => {
      walletConnect.emitter.off('message', onMessage)
    }
  }, [config])

  return null
}
