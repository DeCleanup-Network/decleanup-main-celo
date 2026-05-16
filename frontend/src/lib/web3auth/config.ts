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

function buildModalConnectors(includeSocialLogin: boolean): Web3AuthOptions['modalConfig'] {
  const connectors: NonNullable<Web3AuthOptions['modalConfig']>['connectors'] = {
    [WALLET_CONNECTORS.METAMASK]: { label: 'MetaMask', showOnModal: true, loginMethods: {} },
    [WALLET_CONNECTORS.WALLET_CONNECT_V2]: {
      label: 'WalletConnect',
      showOnModal: true,
      loginMethods: {},
    },
  }
  if (includeSocialLogin) {
    connectors[WALLET_CONNECTORS.AUTH] = { label: 'Social / Email', loginMethods: {} }
  }
  return { connectors }
}

function buildWeb3AuthOptions(includeSocialLogin: boolean): Web3AuthOptions {
  return {
    clientId: clientId || '',
    web3AuthNetwork,
    chains: [activeChainConfig],
    defaultChainId: REQUIRED_CHAIN_ID_HEX,
    storageType: 'local',
    sessionTime: 86400,
    mfaLevel: MFA_LEVELS.NONE,
    uiConfig: { uxMode: authUxMode() },
    modalConfig: buildModalConnectors(includeSocialLogin),
  }
}

/** Full config (social + external wallets). Used when Wallet Services feature-access is OK. */
export function createWeb3AuthContextConfig(includeSocialLogin: boolean): Web3AuthContextConfig {
  return { web3AuthOptions: buildWeb3AuthOptions(includeSocialLogin) }
}

/** Default export for tests; production mounts via {@link createWeb3AuthContextConfig} after feature probe. */
export const web3AuthContextConfig = createWeb3AuthContextConfig(true)

export const isWeb3AuthEnabled = Boolean(clientId)
