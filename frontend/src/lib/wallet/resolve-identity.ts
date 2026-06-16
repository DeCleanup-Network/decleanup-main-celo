import 'server-only'

import type { Address, PublicClient } from 'viem'
import { getAddress, isAddress } from 'viem'
import { createPublicClient, http } from 'viem'
import { REQUIRED_CHAIN_ID, REQUIRED_RPC_URL } from '@/lib/blockchain/chain-constants'
import { prisma } from '@/lib/db/prisma'
import { predictSafeAddressFromOwnerAddress } from '@/lib/wallet/predict-safe-from-address'

const SAFE_GET_OWNERS_ABI = [
  {
    type: 'function',
    name: 'getOwners',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address[]' }],
  },
] as const

export type ResolvedWalletIdentity = {
  eoaAddress: Address
  smartAccountAddress: Address | null
  /** Canonical public identity — always the EOA when known. */
  publicAddress: Address
  /** Input matched a stored smart account and should redirect to the EOA URL. */
  redirectToPublicAddress: boolean
}

function publicClient(): PublicClient {
  const isMainnet = REQUIRED_CHAIN_ID === 42220
  return createPublicClient({
    chain: {
      id: REQUIRED_CHAIN_ID,
      name: isMainnet ? 'Celo' : 'Celo Sepolia',
      nativeCurrency: { decimals: 18, name: 'CELO', symbol: 'CELO' },
      rpcUrls: { default: { http: [REQUIRED_RPC_URL] } },
    },
    transport: http(REQUIRED_RPC_URL),
  })
}

async function readSafeOwner(safeLike: Address): Promise<Address | null> {
  try {
    const client = publicClient()
    const owners = await client.readContract({
      address: safeLike,
      abi: SAFE_GET_OWNERS_ABI,
      functionName: 'getOwners',
    })
    const first = owners[0]
    return first ? (getAddress(first) as Address) : null
  } catch {
    return null
  }
}

async function hasContractCode(address: Address): Promise<boolean> {
  try {
    const code = await publicClient().getBytecode({ address })
    return Boolean(code && code !== '0x')
  } catch {
    return false
  }
}

/**
 * Resolve EOA ↔ smart account for portfolio URLs and reward/submission lookups.
 * Onchain submission history stays under the smart account; public identity is the EOA.
 */
export async function resolveWalletIdentity(input: string): Promise<ResolvedWalletIdentity | null> {
  if (!isAddress(input)) return null
  const addr = getAddress(input) as Address
  const lower = addr.toLowerCase()

  const byEoa = await prisma.userWallet.findUnique({ where: { address: lower } })
  if (byEoa) {
    const eoa = getAddress(byEoa.address) as Address
    const smart = getAddress(byEoa.smartAccountAddress) as Address
    return {
      eoaAddress: eoa,
      smartAccountAddress: smart,
      publicAddress: eoa,
      redirectToPublicAddress: false,
    }
  }

  const bySmart = await prisma.userWallet.findFirst({
    where: { smartAccountAddress: lower },
  })
  if (bySmart) {
    const eoa = getAddress(bySmart.address) as Address
    const smart = getAddress(bySmart.smartAccountAddress) as Address
    return {
      eoaAddress: eoa,
      smartAccountAddress: smart,
      publicAddress: eoa,
      redirectToPublicAddress: true,
    }
  }

  const predictedSafe = await predictSafeAddressFromOwnerAddress(addr).catch(() => null)
  if (predictedSafe && predictedSafe.toLowerCase() === lower) {
    const owner = await readSafeOwner(addr)
    if (owner) {
      return {
        eoaAddress: owner,
        smartAccountAddress: addr,
        publicAddress: owner,
        redirectToPublicAddress: true,
      }
    }
    return null
  }

  if (predictedSafe && predictedSafe.toLowerCase() !== lower) {
    const deployed = await hasContractCode(predictedSafe)
    if (deployed || !(await hasContractCode(addr))) {
      return {
        eoaAddress: addr,
        smartAccountAddress: predictedSafe,
        publicAddress: addr,
        redirectToPublicAddress: false,
      }
    }
  }

  if (await hasContractCode(addr)) {
    const owner = await readSafeOwner(addr)
    if (owner) {
      return {
        eoaAddress: owner,
        smartAccountAddress: addr,
        publicAddress: owner,
        redirectToPublicAddress: true,
      }
    }
  }

  return {
    eoaAddress: addr,
    smartAccountAddress: null,
    publicAddress: addr,
    redirectToPublicAddress: false,
  }
}
