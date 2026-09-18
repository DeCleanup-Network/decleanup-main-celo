import { isMobileBrowser } from '@/lib/blockchain/mobile-browser'

/**
 * WalletConnect universal link for a pairing URI.
 * Only call this from a user gesture: on mobile it hands the tab over to the wallet app.
 */
export function openWalletConnectFallbackLink(uri: string): void {
  if (typeof window === 'undefined' || !uri) return
  const href = `https://walletconnect.com/wc?uri=${encodeURIComponent(uri)}`

  if (isMobileBrowser()) {
    window.location.assign(href)
    return
  }

  window.open(href, '_blank', 'noopener,noreferrer')
}
