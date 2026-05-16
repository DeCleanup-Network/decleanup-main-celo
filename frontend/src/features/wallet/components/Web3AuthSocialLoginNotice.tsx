'use client'

import {
  web3AuthClientId,
  web3AuthSapphireNetworkLabel,
  WEB3AUTH_NETWORK_ENV_MAINNET,
} from '@/lib/web3auth/config'
import { WEB3AUTH_DEVELOPER_DASHBOARD_URL } from '@/lib/web3auth/urls'

const METAMASK_PRICING_URL = 'https://web3auth.io/pricing.html'

/**
 * Inline notice when Wallet Services / social login is blocked (403) but MetaMask can still connect.
 */
export function Web3AuthSocialLoginNotice() {
  const clientHint =
    web3AuthClientId.length > 12
      ? `…${web3AuthClientId.slice(-8)}`
      : web3AuthClientId || '(not set)'

  return (
    <p className="max-w-[min(100%,22rem)] text-center text-[10px] leading-snug text-amber-200/85">
      Google / email login needs <strong className="text-gray-300">Wallet Services</strong> on{' '}
      <strong className="text-gray-300">{web3AuthSapphireNetworkLabel}</strong> (client{' '}
      <code className="text-[9px]">{clientHint}</code>). The free <strong className="text-gray-300">Base</strong>{' '}
      plan includes Wallet Services on Sapphire Devnet only; production ({WEB3AUTH_NETWORK_ENV_MAINNET}) requires{' '}
      <strong className="text-gray-300">Scale</strong> or higher.{' '}
      <a
        href={METAMASK_PRICING_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-green underline underline-offset-2"
      >
        View pricing
      </a>{' '}
      or{' '}
      <a
        href={WEB3AUTH_DEVELOPER_DASHBOARD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-green underline underline-offset-2"
      >
        dashboard
      </a>
      . Use <strong className="text-gray-300">MetaMask</strong> below meanwhile.
    </p>
  )
}
