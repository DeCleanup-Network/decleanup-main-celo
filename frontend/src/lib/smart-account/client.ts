'use client'

import type { Address, Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createPublicClient, formatEther, http } from 'viem'
import { entryPoint07Address } from 'viem/account-abstraction'
import { REQUIRED_CHAIN_ID, REQUIRED_RPC_URL } from '@/lib/blockchain/chain-constants'

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

function getPimlicoUrl(): string {
  const apiKey = process.env.NEXT_PUBLIC_PIMLICO_API_KEY?.trim()
  if (!apiKey) throw new Error('NEXT_PUBLIC_PIMLICO_API_KEY is not set')
  const slug = REQUIRED_CHAIN_ID === 42220 ? 'celo' : 'celo-sepolia'
  return `https://api.pimlico.io/v2/${slug}/rpc?apikey=${apiKey}`
}

export async function createClientSmartAccountClient(privateKeyHex: Hex) {
  const owner = privateKeyToAccount(privateKeyHex)
  const pimlicoUrl = getPimlicoUrl()
  const { createSmartAccountClient } = await import('permissionless')
  const { toSafeSmartAccount } = await import('permissionless/accounts')
  const { createPimlicoClient } = await import('permissionless/clients/pimlico')

  const chain = getChain()
  const publicClient = createPublicClient({ chain, transport: http(REQUIRED_RPC_URL) })

  const safeAccount = await toSafeSmartAccount({
    client: publicClient,
    owners: [owner],
    entryPoint,
    version: '1.4.1',
  })

  const pimlicoClient = createPimlicoClient({
    transport: http(pimlicoUrl),
    entryPoint,
  })

  return createSmartAccountClient({
    account: safeAccount,
    chain,
    bundlerTransport: http(pimlicoUrl),
    paymaster: true,
    userOperation: {
      estimateFeesPerGas: async () => {
        const gas = await pimlicoClient.getUserOperationGasPrice()
        return gas.fast
      },
    },
  })
}

export async function sendGaslessUserOperation(
  privateKeyHex: Hex,
  params: { to: Address; value?: bigint; data?: Hex }
): Promise<{ userOpHash: Hex; smartAccountAddress: Address }> {
  const client = await createClientSmartAccountClient(privateKeyHex)
  const hash = await client.sendTransaction({
    to: params.to,
    value: params.value ?? 0n,
    data: params.data ?? '0x',
  })
  return { userOpHash: hash, smartAccountAddress: client.account.address }
}

export async function getClientSmartAccountBalance(address: Address): Promise<string> {
  const publicClient = createPublicClient({
    chain: getChain(),
    transport: http(REQUIRED_RPC_URL),
  })
  const wei = await publicClient.getBalance({ address })
  return formatEther(wei)
}

export { getClientUserOperationReceiptSafe as getClientUserOperationReceipt } from '@/lib/smart-account/wait-user-op'
export {
  waitForGaslessUserOperationConfirmation,
  waitForGaslessUserOperationConfirmation as waitForGaslessUserOperationReceipt,
} from '@/lib/smart-account/wait-user-op'
