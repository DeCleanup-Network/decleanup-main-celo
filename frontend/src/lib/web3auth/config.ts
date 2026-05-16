'use client'

import type { Web3AuthContextConfig } from '@web3auth/modal/react'
import { CHAIN_NAMESPACES, WALLET_CONNECTORS, type Web3AuthOptions } from '@web3auth/modal'
import { MFA_LEVELS } from '@web3auth/auth'
import { getCeloSepoliaRpcTargetForWeb3Auth } from '@/lib/blockchain/celo-sepolia-rpc-url'
import {
  parseWeb3AuthNetworkFromEnv,
  WEB3AUTH_NETWORK_ENV_DEVNET,
  WEB3AUTH_NETWORK_ENV_MAINNET,
  web3AuthNetworkToApiParam,
  web3AuthNetworkToLabel,
} from '@/lib/web3auth/network-env'
import {
  REQUIRED_BLOCK_EXPLORER_URL,
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_ID_HEX,
  REQUIRED_CHAIN_NAME,
  REQUIRED_RPC_URL,
} from '@/lib/blockchain/chain-constants'

const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID?.trim()

if (!clientId && typeof window !== 'undefined') {
  console.warn(
    'NEXT_PUBLIC_WEB3AUTH_CLIENT_ID is not set. Get your Client ID from https://dashboard.web3auth.io/'
  )
}

// Web3Auth "network" = Sapphire backend (dashboard label), NOT Celo/Ethereum mainnet. Set env to match the project row:
// NEXT_PUBLIC_WEB3AUTH_NETWORK=sapphire_mainnet | sapphire_devnet (legacy: mainnet | devnet).
// If the console shows 403 on .../feature-access?...&is_wallet_service=true — enable Wallet Services for that Client ID.
const web3AuthNetwork = parseWeb3AuthNetworkFromEnv(process.env.NEXT_PUBLIC_WEB3AUTH_NETWORK)

/** API `network` query param (matches dashboard tag `sapphire_mainnet`). */
export const web3AuthSapphireNetwork = web3AuthNetworkToApiParam(web3AuthNetwork)

/** Human label for errors (matches dashboard: "Sapphire Mainnet"). */
export const web3AuthSapphireNetworkLabel = web3AuthNetworkToLabel(web3AuthNetwork)

export { WEB3AUTH_NETWORK_ENV_DEVNET, WEB3AUTH_NETWORK_ENV_MAINNET }

export const web3AuthClientId = clientId ?? ''

// Web3Auth runs RPC from wallet.web3auth.io — must not use localhost /api/rpc (loopback blocked).
// SDK requires chainId as hex string, and Web3Auth compares this value literally.
const activeRpcTarget =
  REQUIRED_CHAIN_ID === 11142220 ? getCeloSepoliaRpcTargetForWeb3Auth() : REQUIRED_RPC_URL

const activeChainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: REQUIRED_CHAIN_ID_HEX,
  rpcTarget: activeRpcTarget,
  displayName: REQUIRED_CHAIN_NAME,
  blockExplorerUrl: REQUIRED_BLOCK_EXPLORER_URL,
  ticker: 'CELO',
  tickerName: 'CELO',
  decimals: 18,
  logo: 'https://celo.org/favicon.ico',
}

/** Popup works reliably for desktop OAuth; full-page redirect can strand the modal if the return URL isn’t completed. */
function authUxMode(): 'popup' | 'redirect' {
  const forcedUxMode = process.env.NEXT_PUBLIC_WEB3AUTH_UX_MODE?.trim().toLowerCase()
  if (forcedUxMode === 'popup' || forcedUxMode === 'redirect') {
    return forcedUxMode
  }
  if (typeof navigator === 'undefined') return 'popup'
  // Prefer popup by default; mobile redirect can stall on email verification return
  // in some in-app browsers and strict mobile privacy settings.
  return 'popup'
}

const web3AuthOptions: Web3AuthOptions = {
  clientId: clientId || '',
  web3AuthNetwork,
  chains: [activeChainConfig],
  defaultChainId: REQUIRED_CHAIN_ID_HEX,
  /** Keep login session in localStorage (default); survives tab switches better than session-only. */
  storageType: 'local',
  /**
   * idToken lifetime (seconds). Web3Auth **Base** plan allows at most **1 day**; longer sessions and
   * custom branding (see `uiConfig`) require a higher tier — otherwise signer returns 403 / code 1003.
   */
  sessionTime: 86400,
  /**
   * Skip Web3Auth “set up MFA” flows by default. (Google/Microsoft may still ask for 2FA per *their* policy.)
   * @see https://web3auth.io/docs/sdk/helper-sdks/authentication
   */
  mfaLevel: MFA_LEVELS.NONE,
  /**
   * Desktop: popup OAuth (modal completes in-page). Mobile: redirect (Safari popups are flaky).
   * Forcing redirect everywhere broke “pick Google account → nothing happens” when the SDK didn’t finish the return leg.
   */
  // Do not set appName/logo/theme here: those count as **whitelabel** and are not available on the
  // Base dashboard plan (API: is_whitelabel=true → 403). Only uxMode is safe on Base.
  uiConfig: {
    uxMode: authUxMode(),
  },
  // Social/email + MetaMask + WalletConnect. Do not add WALLET_CONNECTORS.COINBASE unless you
  // install the optional peer `@coinbase/wallet-sdk` (otherwise init throws: "Connector coinbase is not configured").
  // Each connector config must include loginMethods so filterConnectors doesn't read undefined.
  modalConfig: {
    connectors: {
      [WALLET_CONNECTORS.AUTH]: { label: 'Social / Email', loginMethods: {} },
      [WALLET_CONNECTORS.METAMASK]: { label: 'MetaMask', showOnModal: true, loginMethods: {} },
      [WALLET_CONNECTORS.WALLET_CONNECT_V2]: { label: 'WalletConnect', showOnModal: true, loginMethods: {} },
    },
  },
}


export const web3AuthContextConfig: Web3AuthContextConfig = {
  web3AuthOptions,
}

export const isWeb3AuthEnabled = Boolean(clientId)
