'use client'

import { Button } from '@/components/ui/button'
import {
  web3AuthClientId,
  web3AuthSapphireNetworkLabel,
  WEB3AUTH_NETWORK_ENV_DEVNET,
  WEB3AUTH_NETWORK_ENV_MAINNET,
} from '@/lib/web3auth/config'
import { WEB3AUTH_DEVELOPER_DASHBOARD_URL } from '@/lib/web3auth/urls'

type Props = {
  onReload?: () => void
}

/**
 * Shown when signer feature-access returns 403 (Wallet Services not enabled for this Client ID).
 */
export function Web3AuthLoginBlocked({ onReload }: Props) {
  const clientHint =
    web3AuthClientId.length > 12
      ? `…${web3AuthClientId.slice(-8)}`
      : web3AuthClientId || '(not set)'

  return (
    <div className="flex max-w-[min(100%,min(100vw-2rem,400px))] flex-col items-center gap-3 text-center">
      <p className="text-xs font-medium text-amber-300/95">Social login is not enabled for this app</p>
      <p className="text-[11px] leading-snug text-gray-400">
        Web3Auth returned <strong className="text-gray-300">403</strong> for Wallet Services on{' '}
        <strong className="text-gray-300">{web3AuthSapphireNetworkLabel}</strong> (client{' '}
        <code className="text-[10px]">{clientHint}</code>). In the{' '}
        <a
          href={WEB3AUTH_DEVELOPER_DASHBOARD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-green underline underline-offset-2 hover:text-brand-green/90"
        >
          Web3Auth dashboard
        </a>
        , open this project and enable <strong className="text-gray-300">Wallet Services</strong> (or upgrade the
        plan). If the dashboard shows <strong className="text-gray-300">Sapphire Devnet</strong>, set{' '}
        <code className="rounded bg-white/5 px-1 py-0.5 text-[10px]">
          NEXT_PUBLIC_WEB3AUTH_NETWORK={WEB3AUTH_NETWORK_ENV_DEVNET}
        </code>{' '}
        on Vercel (not {WEB3AUTH_NETWORK_ENV_MAINNET}). MetaMask login may still work after a reload.
      </p>
      <p className="text-[10px] text-gray-500">
        &quot;SES Removing unpermitted intrinsics&quot; in the console is from a browser extension, not this app.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-gray-600 font-sans text-gray-200"
          onClick={onReload ?? (() => window.location.reload())}
        >
          Reload page
        </Button>
        <a
          href="/reset-wallet-session"
          className="text-xs font-medium text-brand-green underline underline-offset-2 hover:text-brand-green/90"
        >
          Reset session
        </a>
      </div>
    </div>
  )
}
