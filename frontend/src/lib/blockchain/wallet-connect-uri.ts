/**
 * Latest WalletConnect pairing URI (from the connector `display_uri` event).
 * Kept outside React so any connect button can offer a manual deep link / QR fallback
 * when the AppKit modal does not show up.
 */
let currentUri: string | null = null
const listeners = new Set<(uri: string | null) => void>()

export function setWalletConnectUri(uri: string | null): void {
  if (currentUri === uri) return
  currentUri = uri
  for (const listener of listeners) listener(uri)
}

export function getWalletConnectUri(): string | null {
  return currentUri
}

export function subscribeWalletConnectUri(listener: (uri: string | null) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
