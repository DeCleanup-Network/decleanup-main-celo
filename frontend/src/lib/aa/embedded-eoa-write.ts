'use client'

import type { Address, Hex } from 'viem'
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { REQUIRED_CHAIN_ID, REQUIRED_RPC_URL } from '@/lib/blockchain/chain-constants'

function getChain() {
  const isMainnet = REQUIRED_CHAIN_ID === 42220
  return {
    id: REQUIRED_CHAIN_ID,
    name: isMainnet ? 'Celo' : 'Celo Sepolia',
    nativeCurrency: { decimals: 18, name: 'CELO', symbol: 'CELO' },
    rpcUrls: { default: { http: [REQUIRED_RPC_URL] } },
  } as const
}

export type EmbeddedEoaWriteParams = {
  address: Address
  abi: readonly unknown[]
  functionName: string
  args: readonly unknown[]
  value?: bigint
}

/** Contract write from the embedded Google/email EOA (pays gas on Celo; no wagmi / WalletConnect). */
export async function writeContractWithEmbeddedEoa(
  privateKeyHex: Hex,
  params: EmbeddedEoaWriteParams
): Promise<Hex> {
  const account = privateKeyToAccount(privateKeyHex)
  const chain = getChain()
  const client = createWalletClient({
    account,
    chain,
    transport: http(REQUIRED_RPC_URL),
  })

  const base = {
    chain,
    account,
    address: params.address,
    abi: params.abi,
    functionName: params.functionName,
    args: params.args,
  }
  type WriteParams = Parameters<typeof client.writeContract>[0]
  if (params.value != null && params.value > 0n) {
    return client.writeContract({ ...base, value: params.value } as unknown as WriteParams)
  }
  return client.writeContract(base as unknown as WriteParams)
}
