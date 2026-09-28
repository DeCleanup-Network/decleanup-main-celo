'use client'

import type { Address, Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createPublicClient, erc20Abi, formatEther, getAddress, http, isAddress, parseEther } from 'viem'
import { entryPoint07Address } from 'viem/account-abstraction'
import { CONTRACT_ADDRESSES, REQUIRED_RPC_URL } from '@/lib/blockchain/chain-constants'
import { getActiveAaChain, getPimlicoBundlerUrl } from '@/lib/blockchain/aa-chain'
import { getExperienceDisplay } from '@/lib/blockchain/experience-display'

const entryPoint = { address: entryPoint07Address as Address, version: '0.7' as const }

function getPimlicoUrl(): string {
  const apiKey = process.env.NEXT_PUBLIC_PIMLICO_API_KEY?.trim()
  if (!apiKey) throw new Error('NEXT_PUBLIC_PIMLICO_API_KEY is not set')
  return getPimlicoBundlerUrl(apiKey)
}

export async function createClientSmartAccountClient(privateKeyHex: Hex) {
  const owner = privateKeyToAccount(privateKeyHex)
  const pimlicoUrl = getPimlicoUrl()
  const { createSmartAccountClient } = await import('permissionless')
  const { toSafeSmartAccount } = await import('permissionless/accounts')
  const { createPimlicoClient } = await import('permissionless/clients/pimlico')

  const chain = getActiveAaChain()
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
    chain: getActiveAaChain(),
    transport: http(REQUIRED_RPC_URL),
  })
  const wei = await publicClient.getBalance({ address })
  return formatEther(wei)
}

/** Native gas token (CELO or ETH) for the selected experience chain. */
export async function getClientExperienceNativeBalance(
  address: Address,
  chainId?: number
): Promise<string | null> {
  const display = getExperienceDisplay(chainId)
  if (!isAddress(address)) return null
  try {
    const publicClient = createPublicClient({
      chain: getActiveAaChain(display.chainId),
      transport: http(display.rpcUrl),
    })
    const wei = await publicClient.getBalance({ address })
    return formatEther(wei)
  } catch {
    return null
  }
}

/** ERC-20 reward token ($cDCU, $bDCU, or $rDCU) for a specific experience chain. */
export async function getClientExperienceTokenBalance(
  address: Address,
  chainId?: number
): Promise<string | null> {
  const display = getExperienceDisplay(chainId)
  const token = display.tokenAddress
  if (!token || !isAddress(token) || !isAddress(address)) return null
  try {
    const publicClient = createPublicClient({
      chain: getActiveAaChain(display.chainId),
      transport: http(display.rpcUrl),
    })
    const raw = await publicClient.readContract({
      address: token as Address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address],
    })
    return formatEther(raw)
  } catch {
    return null
  }
}

/** Sum $cDCU / $bDCU / $rDCU across signer and smart account (they are not always the same address). */
export async function getMergedExperienceTokenBalance(
  addresses: Array<Address | string | null | undefined>,
  chainId?: number
): Promise<string | null> {
  const unique: Address[] = []
  const seen = new Set<string>()
  for (const raw of addresses) {
    if (!raw || !isAddress(raw)) continue
    const addr = getAddress(raw)
    const key = addr.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(addr)
  }
  if (unique.length === 0) return null
  const parts = await Promise.all(unique.map((addr) => getClientExperienceTokenBalance(addr, chainId)))
  let sumWei = 0n
  let any = false
  for (const part of parts) {
    if (part == null) continue
    any = true
    try {
      sumWei += parseEther(part)
    } catch {
      /* skip unparseable */
    }
  }
  return any ? formatEther(sumWei) : null
}

/** ERC-20 $cDCU balance on an address (smart account or EOA). Returns null if token not configured. */
export async function getClientCdcuTokenBalance(address: Address): Promise<string | null> {
  const token = CONTRACT_ADDRESSES.DCU_TOKEN?.trim()
  if (!token || !isAddress(token) || !isAddress(address)) return null
  return getClientExperienceTokenBalance(address)
}

export { getClientUserOperationReceiptSafe as getClientUserOperationReceipt } from '@/lib/smart-account/wait-user-op'
export {
  waitForGaslessUserOperationConfirmation,
  waitForGaslessUserOperationConfirmation as waitForGaslessUserOperationReceipt,
} from '@/lib/smart-account/wait-user-op'
