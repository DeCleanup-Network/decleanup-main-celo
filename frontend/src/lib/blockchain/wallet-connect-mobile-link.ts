/** Opens WalletConnect URI on mobile (Safari cannot scan QR — needs universal link). */
export function openWalletConnectMobileLink(uri: string): void {
  if (typeof window === 'undefined' || !uri) return
  const href = `https://walletconnect.com/wc?uri=${encodeURIComponent(uri)}`
  window.location.assign(href)
}
