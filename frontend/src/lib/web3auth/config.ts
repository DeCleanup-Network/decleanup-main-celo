'use client'

import type { Web3AuthContextConfig } from '@web3auth/modal/react'
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK, WALLET_CONNECTORS, type Web3AuthOptions } from '@web3auth/modal'
import { MFA_LEVELS } from '@web3auth/auth'
import { REQUIRED_CHAIN_ID_HEX } from '@/lib/blockchain/chain-constants'

const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID?.trim()

if (!clientId && typeof window !== 'undefined') {
  console.warn(
    'NEXT_PUBLIC_WEB3AUTH_CLIENT_ID is not set. Get your Client ID from https://dashboard.web3auth.io/'
  )
}

// Web3Auth "network" = their backend (Sapphire), not the blockchain. Your chain is Celo Sepolia (set below in chains).
// MUST match dashboard.web3auth.io → Project → network (Sapphire Devnet vs Sapphire Mainnet).
// If you set NEXT_PUBLIC_WEB3AUTH_NETWORK=mainnet but the project is still Devnet, the API returns 400 and
// "Network mismatch ... sapphire_mainnet ... sapphire_devnet". Fix: remove the env var (use devnet) or move the project to Mainnet in the dashboard.
// 403 on .../signer-service/api/feature-access?...&is_wallet_service=true means **Wallet Services** (embedded
// signer UI) is not allowed for this Client ID on the current **Web3Auth plan**. Social login uses the
// embedded wallet stack — you must enable Wallet Services / upgrade the plan at https://dashboard.web3auth.io
// (Base tier often does not include it). This is not fixable by sessionTime/whitelabel/CORS alone.
const web3AuthNetwork =
  process.env.NEXT_PUBLIC_WEB3AUTH_NETWORK === 'mainnet'
    ? WEB3AUTH_NETWORK.SAPPHIRE_MAINNET
    : WEB3AUTH_NETWORK.SAPPHIRE_DEVNET

// Celo Sepolia: MUST be a fixed public HTTPS RPC — never env/proxy. The embedded wallet runs on
// https://wallet.web3auth.io; it cannot call http://127.0.0.1:3000/api/rpc (PNA / loopback block).
// Do not use getCeloSepoliaHttpRpcUrl() or NEXT_PUBLIC_* that might point at /api/rpc here.
// SDK requires chainId as hex string. MUST match `REQUIRED_CHAIN_ID_HEX` (lowercase `0xaa044c`).
const CELO_SEPOLIA_RPC_FOR_WEB3AUTH = 'https://celo-sepolia.drpc.org'

const celoSepoliaChainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: REQUIRED_CHAIN_ID_HEX,
  rpcTarget: CELO_SEPOLIA_RPC_FOR_WEB3AUTH,
  displayName: 'Celo Sepolia Testnet',
  blockExplorerUrl: 'https://celo-sepolia.blockscout.com',
  ticker: 'CELO',
  tickerName: 'CELO',
  decimals: 18,
  logo: 'https://celo.org/favicon.ico',
}

/** Popup works reliably for desktop OAuth; full-page redirect can strand the modal if the return URL isn’t completed. */
function authUxMode(): 'popup' | 'redirect' {
  if (typeof navigator === 'undefined') return 'popup'
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'redirect' : 'popup'
}

const web3AuthOptions: Web3AuthOptions = {
  clientId: clientId || '',
  web3AuthNetwork,
  chains: [celoSepoliaChainConfig],
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
