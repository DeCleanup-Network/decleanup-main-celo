'use client'

import { useEffect } from 'react'
import { getConnectors } from '@wagmi/core'
import { useConfig } from 'wagmi'
import { isMobileBrowser } from '@/lib/blockchain/mobile-browser'
import { openWalletConnectFallbackLink } from '@/lib/blockchain/wallet-connect-mobile-link'

function hasWalletConnectModalOpen(): boolean {
  return Boolean(
    document.querySelector(
      'w3m-modal, wcm-modal, appkit-modal, [data-w3m-modal], [data-testid="w3m-modal"]'
    )
  )
}

type ConnectorMessage = {
  type: string
  data?: unknown
}

/**
 * If AppKit / QR modal never mounts after display_uri, open the WalletConnect universal link.
 * Mobile: same-tab deep link. Desktop: new tab so the dapp stays open.
 */
export function WalletConnectUriOpener() {
  const config = useConfig()

  useEffect(() => {
    const walletConnect = getConnectors(config).find((c) => c.id === 'walletConnect')
    if (!walletConnect) return

    const onMessage = (message: ConnectorMessage) => {
      if (message.type !== 'display_uri' || typeof message.data !== 'string') return
      const uri = message.data

      window.setTimeout(() => {
        if (hasWalletConnectModalOpen()) return
        openWalletConnectFallbackLink(uri)
      }, isMobileBrowser() ? 1200 : 1800)
    }

    walletConnect.emitter.on('message', onMessage)
    return () => {
      walletConnect.emitter.off('message', onMessage)
    }
  }, [config])

  return null
}
