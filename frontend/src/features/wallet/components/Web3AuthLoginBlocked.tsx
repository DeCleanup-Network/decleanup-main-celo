'use client'

import { Button } from '@/components/ui/button'
import {
  web3AuthClientId,
  web3AuthSapphireNetworkLabel,
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
      <p className="text-xs font-medium text-amber-300/95">Wallet login could not start</p>
      <p className="text-[11px] leading-snug text-gray-400">
        <strong className="text-gray-300">403</strong> on Wallet Services for{' '}
        <strong className="text-gray-300">{web3AuthSapphireNetworkLabel}</strong> (client{' '}
        <code className="text-[10px]">{clientHint}</code>). On the free <strong className="text-gray-300">Base</strong>{' '}
        plan, embedded / social wallets work on Sapphire Devnet only;{' '}
        <strong className="text-gray-300">Sapphire Mainnet</strong> needs the{' '}
        <strong className="text-gray-300">Scale</strong> plan or higher. See{' '}
        <a
          href="https://web3auth.io/pricing.html"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-green underline underline-offset-2 hover:text-brand-green/90"
        >
          pricing
        </a>{' '}
        and your{' '}
        <a
          href={WEB3AUTH_DEVELOPER_DASHBOARD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-green underline underline-offset-2 hover:text-brand-green/90"
        >
          developer dashboard
        </a>
        . Try <strong className="text-gray-300">Reset session</strong> then reload; use MetaMask in the login modal if
        shown.
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
