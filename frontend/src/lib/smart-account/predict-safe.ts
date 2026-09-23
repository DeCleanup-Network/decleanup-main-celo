'use client'

import type { Account, Address } from 'viem'
import { entryPoint07Address } from 'viem/account-abstraction'
import { createPublicClient, http } from 'viem'
import { REQUIRED_RPC_URL } from '@/lib/blockchain/chain-constants'
import { getActiveAaChain } from '@/lib/blockchain/aa-chain'
import { withTimeout } from '@/lib/utils/fetch-with-timeout'

const entryPoint = { address: entryPoint07Address as Address, version: '0.7' as const }

/** Counterfactual Safe address for an EOA owner (browser-safe). */
export async function predictSafeAddress(owner: Account): Promise<Address> {
  const { toSafeSmartAccount } = await import('permissionless/accounts')
  const client = createPublicClient({ chain: getActiveAaChain(), transport: http(REQUIRED_RPC_URL) })
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
