import { reconnect, type Config, type Connector } from '@wagmi/core'
import { isMobileBrowser } from '@/lib/blockchain/mobile-browser'

/**
 * Start WalletConnect from a user gesture.
 * Do not pass chainId here: it can block the QR / AppKit modal on desktop.
 * Mobile: light relay reconnect first; UriOpener deep-links if the modal never appears.
 */
export async function connectWithWalletConnect(params: {
  config: Config
  connector: Connector
  connectAsync: (args: { connector: Connector }) => Promise<unknown>
}): Promise<void> {
  const { config, connector, connectAsync } = params
  if (isMobileBrowser()) {
    void reconnect(config).catch(() => {})
  }
  await connectAsync({ connector })
}
