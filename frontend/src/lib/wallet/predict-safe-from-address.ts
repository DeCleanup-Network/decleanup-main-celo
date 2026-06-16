import type { Address } from 'viem'
import { getAddress } from 'viem'
import { toAccount } from 'viem/accounts'
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

/** Counterfactual Safe for a single EOA owner (no private key required). */
export async function predictSafeAddressFromOwnerAddress(ownerAddress: Address): Promise<Address> {
  const owner = getAddress(ownerAddress)
  const { toSafeSmartAccount } = await import('permissionless/accounts')
  const client = createPublicClient({ chain: getChain(), transport: http(REQUIRED_RPC_URL) })
  const safe = await withTimeout(
    toSafeSmartAccount({
      client,
      owners: [toAccount(owner)],
      entryPoint,
      version: '1.4.1',
    }),
    25_000,
    'Safe address prediction'
  )
  return safe.address
}
