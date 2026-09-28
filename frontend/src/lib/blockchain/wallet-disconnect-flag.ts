export const MANUAL_WALLET_DISCONNECT_KEY = 'decleanup:manual-wallet-disconnect'

export function markManualWalletDisconnect(): void {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(MANUAL_WALLET_DISCONNECT_KEY, String(Date.now()))
}

export function isManualWalletDisconnectActive(): boolean {
  if (typeof sessionStorage === 'undefined') return false
  return Boolean(sessionStorage.getItem(MANUAL_WALLET_DISCONNECT_KEY))
}

export function clearManualWalletDisconnect(): void {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(MANUAL_WALLET_DISCONNECT_KEY)
}
