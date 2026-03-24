'use client'

import type { Web3AuthContextConfig } from '@web3auth/modal/react'
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK, WALLET_CONNECTORS, type Web3AuthOptions } from '@web3auth/modal'

const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID

if (!clientId && typeof window !== 'undefined') {
  console.warn(
    'NEXT_PUBLIC_WEB3AUTH_CLIENT_ID is not set. Get your Client ID from https://dashboard.web3auth.io/'
  )
}

// Web3Auth "network" = their backend (Sapphire), not the blockchain. Your chain is Celo Sepolia (set below in chains).
// MUST match dashboard.web3auth.io → Project → network (Sapphire Devnet vs Sapphire Mainnet).
// If you set NEXT_PUBLIC_WEB3AUTH_NETWORK=mainnet but the project is still Devnet, the API returns 400 and
// "Network mismatch ... sapphire_mainnet ... sapphire_devnet". Fix: remove the env var (use devnet) or move the project to Mainnet in the dashboard.
const web3AuthNetwork =
  process.env.NEXT_PUBLIC_WEB3AUTH_NETWORK === 'mainnet'
    ? WEB3AUTH_NETWORK.SAPPHIRE_MAINNET
    : WEB3AUTH_NETWORK.SAPPHIRE_DEVNET

// Celo Sepolia: required so Web3Auth provider has a valid chain. Use alternative RPC if forno returns 403.
// SDK requires chainId as hex string (e.g. '0xAA044C'), not number.
const celoSepoliaRpc =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://celo-sepolia.drpc.org'
const CELO_SEPOLIA_CHAIN_ID_HEX = '0xAA044C' as const // 11142220 in hex

const celoSepoliaChainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: CELO_SEPOLIA_CHAIN_ID_HEX,
  rpcTarget: celoSepoliaRpc,
  displayName: 'Celo Sepolia Testnet',
  blockExplorerUrl: 'https://celo-sepolia.blockscout.com',
  ticker: 'CELO',
  tickerName: 'CELO',
  decimals: 18,
  logo: 'https://celo.org/favicon.ico',
}

const web3AuthOptions: Web3AuthOptions = {
  clientId: clientId || '',
  web3AuthNetwork,
  chains: [celoSepoliaChainConfig],
  defaultChainId: CELO_SEPOLIA_CHAIN_ID_HEX,
  // Show only social/email (Google, etc.); hide MetaMask and other wallet connectors to avoid
  // "Failed to login with MetaMask wallet" when user expects to use Google.
  // Each connector config must have loginMethods so filterConnectors doesn't read undefined (default only has label/showOnModal).
  modalConfig: {
    connectors: {
      [WALLET_CONNECTORS.AUTH]: { label: 'Social / Email', loginMethods: {} },
      [WALLET_CONNECTORS.METAMASK]: { label: 'MetaMask', showOnModal: false, loginMethods: {} },
      [WALLET_CONNECTORS.WALLET_CONNECT_V2]: { label: 'WalletConnect', showOnModal: false, loginMethods: {} },
      [WALLET_CONNECTORS.COINBASE]: { label: 'Coinbase', showOnModal: false, loginMethods: {} },
    },
  },
}


export const web3AuthContextConfig: Web3AuthContextConfig = {
  web3AuthOptions,
}

export const isWeb3AuthEnabled = Boolean(clientId)
