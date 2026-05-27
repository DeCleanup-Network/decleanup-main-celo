/**
 * WalletConnect metadata — url must match the live page origin (see wagmi.ts).
 */

const APP_NAME = 'DeCleanup Rewards'
const APP_DESCRIPTION =
  'Clean up, share proof, and earn tokenized environmental rewards on Celo.'
const APP_ICON_URL =
  process.env.NEXT_PUBLIC_APP_ICON_URL ||
  'https://gateway.pinata.cloud/ipfs/bafkreia2bx2ofiutdzyxyry5wfaq5kj7bcd4wvutpiw6bhbl35qdbmsat4?filename=iconDCU.png'

export function getWalletConnectAppUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_WEB_APP_URL ||
    (typeof process !== 'undefined' && process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : '') ||
    'https://dapp.decleanup.net'
  )
}

export function getWalletConnectMetadata() {
  return {
    name: APP_NAME,
    description: APP_DESCRIPTION,
    url: getWalletConnectAppUrl(),
    icons: [APP_ICON_URL],
  }
}
