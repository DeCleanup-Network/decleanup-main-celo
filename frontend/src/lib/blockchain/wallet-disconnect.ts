import { disconnect, getConnections, type Config } from '@wagmi/core'
import {
  MANUAL_WALLET_DISCONNECT_KEY,
  markManualWalletDisconnect,
} from '@/lib/blockchain/wallet-disconnect-flag'

export {
  MANUAL_WALLET_DISCONNECT_KEY,
  clearManualWalletDisconnect,
  isManualWalletDisconnectActive,
  markManualWalletDisconnect,
} from '@/lib/blockchain/wallet-disconnect-flag'

function clearWagmiCookies(): void {
  if (typeof document === 'undefined') return
  for (const part of document.cookie.split(';')) {
    const name = part.trim().split('=')[0]
    if (!name.startsWith('wagmi')) continue
    document.cookie = `${name}=; path=/; max-age=0`
  }
}

function clearBrowserWalletConnectKeys(): void {
  if (typeof window === 'undefined') return
  const keep = (key: string) =>
    key === MANUAL_WALLET_DISCONNECT_KEY ||
    key.startsWith('decleanup-') ||
    key.startsWith('decleanup:')
  const shouldDrop = (key: string) => {
    if (keep(key)) return false
    const lower = key.toLowerCase()
    return (
      key.startsWith('wagmi') ||
      key.startsWith('wc@2') ||
      key.startsWith('@w3m') ||
      key.startsWith('W3M') ||
      key.startsWith('rk-') ||
      lower.includes('walletconnect')
    )
  }
  for (const store of [window.localStorage, window.sessionStorage]) {
    const toRemove: string[] = []
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      if (key && shouldDrop(key)) toRemove.push(key)
    }
    for (const key of toRemove) store.removeItem(key)
  }
}

/** Awaited disconnect of every wagmi connection, then drop persisted WC/wagmi state. */
export async function disconnectAllWallets(config: Config): Promise<void> {
  markManualWalletDisconnect()
  const connections = getConnections(config)
  await Promise.all(
    connections.map((connection) =>
      disconnect(config, { connector: connection.connector }).catch(() => undefined)
    )
  )
  try {
    await config.storage?.removeItem('recentConnectorId')
    await config.storage?.removeItem('store')
  } catch {
    /* ignore */
  }
  clearWagmiCookies()
  clearBrowserWalletConnectKeys()
}
