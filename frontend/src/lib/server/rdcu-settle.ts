import 'server-only'

import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { getActiveAaChain } from '@/lib/blockchain/aa-chain'
import {
  ROBINHOOD_TESTNET_CHAIN_ID,
  getChainConfig,
} from '@/lib/blockchain/chain-constants'

const RDCU_SETTLE_ABI = [
  {
    type: 'function',
    name: 'settleAfterVerify',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'submissionId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'settleUser',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [],
  },
] as const

function normalizePrivateKey(raw: string | undefined): Hex | undefined {
  if (!raw || typeof raw !== 'string') return undefined
  const trimmed = raw.trim().replace(/^0x/i, '')
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) return undefined
  return `0x${trimmed}` as Hex
}

function settleKey(): Hex | undefined {
  return normalizePrivateKey(process.env.RDCU_SETTLE_PRIVATE_KEY)
}

export function isRdcuServerSettleConfigured(): boolean {
  return Boolean(settleKey() && getChainConfig(ROBINHOOD_TESTNET_CHAIN_ID).contracts.DCU_TOKEN)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function settleRobinhoodRdcuOnServer(params: {
  submissionId?: string
  user?: string
}): Promise<{ hashes: Hex[] }> {
  const key = settleKey()
  const token = getChainConfig(ROBINHOOD_TESTNET_CHAIN_ID).contracts.DCU_TOKEN?.trim() as Address | undefined
  if (!key || !token) {
    throw new Error('rDCU settle is not configured')
  }

  const chain = getActiveAaChain(ROBINHOOD_TESTNET_CHAIN_ID)
  const account = privateKeyToAccount(key)
  const wallet = createWalletClient({
    account,
    chain,
    transport: http(chain.rpcUrls.default.http[0]),
  })
  const publicClient = createPublicClient({
    chain,
    transport: http(chain.rpcUrls.default.http[0]),
  })

  const hashes: Hex[] = []

  const send = async (fn: 'settleAfterVerify' | 'settleUser', args: readonly [bigint] | readonly [Address]) => {
    let lastError: unknown
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const hash = await wallet.writeContract({
          address: token,
          abi: RDCU_SETTLE_ABI,
          functionName: fn,
          args: args as [bigint] | [Address],
          account,
          chain,
        })
        await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 })
        hashes.push(hash)
        return
      } catch (error) {
        lastError = error
        await sleep(1_200 * (attempt + 1))
      }
    }
    throw lastError instanceof Error ? lastError : new Error('rDCU settle failed')
  }

  if (params.submissionId) {
    await send('settleAfterVerify', [BigInt(params.submissionId)])
  }
  if (params.user) {
    await send('settleUser', [params.user as Address])
  }

  return { hashes }
}
