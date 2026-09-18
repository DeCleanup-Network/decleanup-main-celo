/** WalletConnect universal link when AppKit / QR UI fails to appear. */
export function openWalletConnectFallbackLink(uri: string): void {
  if (typeof window === 'undefined' || !uri) return
  const href = `https://walletconnect.com/wc?uri=${encodeURIComponent(uri)}`
  // Mobile Safari needs same-tab navigation to hand off to the wallet app.
  // Desktop: keep the dapp tab and open WC in a new one.
  const mobile =
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)

  if (mobile) {
    window.location.assign(href)
    return
  }

  const w = window.open(href, '_blank', 'noopener,noreferrer')
  if (!w) {
    // Popup blocked: last resort same-tab (user can go back).
    window.location.assign(href)
  }
}

/** @deprecated use openWalletConnectFallbackLink */
export function openWalletConnectMobileLink(uri: string): void {
  openWalletConnectFallbackLink(uri)
}
