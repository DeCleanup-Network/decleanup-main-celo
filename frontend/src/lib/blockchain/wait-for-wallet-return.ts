import { isMobileBrowser } from '@/lib/blockchain/wallet-provider-write'

/**
 * After a WalletConnect chain switch, the wallet app shows "return to the browser".
 * Wait until Safari/Chrome is visible again before eth_sendTransaction or the prompt is lost.
 */
export async function waitForUserReturnFromWallet(maxMs = 90_000): Promise<void> {
  if (!isMobileBrowser() || typeof document === 'undefined') return
  if (document.visibilityState === 'visible') {
    await new Promise((r) => setTimeout(r, 400))
    return
  }

  await new Promise<void>((resolve) => {
    const done = () => {
      document.removeEventListener('visibilitychange', onVisible)
      resolve()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') done()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.setTimeout(done, maxMs)
  })

  await new Promise((r) => setTimeout(r, 400))
}
