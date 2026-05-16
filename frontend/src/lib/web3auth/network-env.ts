import { WEB3AUTH_NETWORK } from '@web3auth/modal'
import type { Web3AuthSapphireNetwork } from '@/lib/web3auth/feature-access'

export type Web3AuthSapphireNetworkLabel = 'Sapphire Mainnet' | 'Sapphire Devnet'

/** Matches MetaMask / Web3Auth dashboard env tag (e.g. `sapphire_mainnet`). */
export const WEB3AUTH_NETWORK_ENV_MAINNET = 'sapphire_mainnet' as const
export const WEB3AUTH_NETWORK_ENV_DEVNET = 'sapphire_devnet' as const

/**
 * Parse `NEXT_PUBLIC_WEB3AUTH_NETWORK` — use dashboard names, not Celo/Ethereum "mainnet".
 * Accepts `sapphire_mainnet`, `sapphire_devnet`, and legacy `mainnet` / `devnet`.
 */
export function parseWeb3AuthNetworkFromEnv(raw: string | undefined): typeof WEB3AUTH_NETWORK.SAPPHIRE_MAINNET | typeof WEB3AUTH_NETWORK.SAPPHIRE_DEVNET {
  const normalized = (raw ?? '').trim().toLowerCase().replace(/-/g, '_')

  if (
    !normalized ||
    normalized === WEB3AUTH_NETWORK_ENV_DEVNET ||
    normalized === 'devnet'
  ) {
    return WEB3AUTH_NETWORK.SAPPHIRE_DEVNET
  }

  if (
    normalized === WEB3AUTH_NETWORK_ENV_MAINNET ||
    normalized === 'mainnet' ||
    normalized === 'saphire_mainnet' ||
    normalized === 'saphire_mainet'
  ) {
    return WEB3AUTH_NETWORK.SAPPHIRE_MAINNET
  }

  if (typeof console !== 'undefined' && raw?.trim()) {
    console.warn(
      `[web3auth] Unknown NEXT_PUBLIC_WEB3AUTH_NETWORK="${raw}". ` +
        `Use ${WEB3AUTH_NETWORK_ENV_MAINNET} or ${WEB3AUTH_NETWORK_ENV_DEVNET} (as in the developer dashboard). ` +
        'Defaulting to Sapphire Devnet.'
    )
  }
  return WEB3AUTH_NETWORK.SAPPHIRE_DEVNET
}

export function web3AuthNetworkToApiParam(
  network: typeof WEB3AUTH_NETWORK.SAPPHIRE_MAINNET | typeof WEB3AUTH_NETWORK.SAPPHIRE_DEVNET
): Web3AuthSapphireNetwork {
  return network === WEB3AUTH_NETWORK.SAPPHIRE_MAINNET ? 'sapphire_mainnet' : 'sapphire_devnet'
}

export function web3AuthNetworkToLabel(
  network: typeof WEB3AUTH_NETWORK.SAPPHIRE_MAINNET | typeof WEB3AUTH_NETWORK.SAPPHIRE_DEVNET
): Web3AuthSapphireNetworkLabel {
  return network === WEB3AUTH_NETWORK.SAPPHIRE_MAINNET ? 'Sapphire Mainnet' : 'Sapphire Devnet'
}
