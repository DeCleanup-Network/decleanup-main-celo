'use client'

import type { Account, Address } from 'viem'
import { entryPoint07Address } from 'viem/account-abstraction'
import { createPublicClient, http } from 'viem'
import { REQUIRED_CHAIN_ID, REQUIRED_RPC_URL } from '@/lib/blockchain/chain-constants'
import { withTimeout } from '@/lib/utils/fetch-with-timeout'

const entryPoint = { address: entryPoint07Address as Address, version: '0.7' as const }

function getChain() {
  const isMainnet = REQUIRED_CHAIN_ID === 42220
  return {
    id: REQUIRED_CHAIN_ID,
    name: isMainnet ? 'Celo' : 'Celo Sepolia',
    nativeCurrency: { decimals: 18, name: 'CELO', symbol: 'CELO' },
    rpcUrls: { default: { http: [REQUIRED_RPC_URL] } },
  } as const
}

/** Counterfactual Safe address for an EOA owner (browser-safe). */
export async function predictSafeAddress(owner: Account): Promise<Address> {
  const { toSafeSmartAccount } = await import('permissionless/accounts')
  const client = createPublicClient({ chain: getChain(), transport: http(REQUIRED_RPC_URL) })
  const safe = await withTimeout(
    toSafeSmartAccount({
      client,
      owners: [owner],
      entryPoint,
      version: '1.4.1',
    }),
    25_000,
    'Safe address prediction'
  )
  return safe.address
}
