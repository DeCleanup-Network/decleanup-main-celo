import 'server-only'
import { cache } from 'react'
import {
  type Address,
  createPublicClient,
  defineChain,
  http,
  isAddress,
  parseAbiItem,
  toEventSelector,
} from 'viem'
import { CELO_MAINNET_CHAIN_ID, CHAIN_CONFIGS } from '@/lib/blockchain/chain-constants'
import { parseContributorIdentities } from '@/lib/proof/contributors'
import { fetchFromIpfsGateways } from '@/lib/utils/ipfs-fetch-gateways'

const ZERO = '0x0000000000000000000000000000000000000000'
const BLOCKSCOUT_LOGS_URL = 'https://celo.blockscout.com/api'
const LOG_TIMEOUT_MS = 10_000
const IPFS_TIMEOUT_MS = 12_000

const SUBMISSION_APPROVED = parseAbiItem(
  'event SubmissionApproved(uint256 indexed submissionId, address indexed approver, uint256 timestamp)'
)
const BONUS_CLAIMED = parseAbiItem(
  'event SubmissionBonusRewardsClaimed(address indexed user, uint256 indexed submissionId, bool impactReportRewarded, bool recyclablesRewarded)'
)

const SUBMISSION_ABI = [
  {
    type: 'function',
    name: 'getSubmissionDetails',
    stateMutability: 'view',
    inputs: [{ name: 'submissionId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'submitter', type: 'address' },
          { name: 'dataURI', type: 'string' },
          { name: 'beforePhotoHash', type: 'string' },
          { name: 'afterPhotoHash', type: 'string' },
          { name: 'impactFormDataHash', type: 'string' },
          { name: 'latitude', type: 'int256' },
          { name: 'longitude', type: 'int256' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'approver', type: 'address' },
          { name: 'processedTimestamp', type: 'uint256' },
          { name: 'rewarded', type: 'bool' },
          { name: 'feePaid', type: 'uint256' },
          { name: 'feeRefunded', type: 'bool' },
          { name: 'hasImpactForm', type: 'bool' },
          { name: 'hasRecyclables', type: 'bool' },
          { name: 'recyclablesPhotoHash', type: 'string' },
          { name: 'recyclablesReceiptHash', type: 'string' },
        ],
      },
    ],
  },
] as const

export type ProofOnchainReview = {
  organizer: string | null
  reviewer: string | null
  reviewedAtUnix: number | null
  reviewTxHash: string | null
  claimTxHash: string | null
  contributors: string[]
}

type ProofTxMaps = {
  review: Map<string, string>
  claim: Map<string, string>
}

type BlockscoutLog = {
  transactionHash?: unknown
  topics?: unknown
}

function asWallet(value: unknown): string | null {
  if (typeof value !== 'string' || !isAddress(value) || value.toLowerCase() === ZERO) return null
  return value
}

function asUnix(value: unknown): number | null {
  const n = typeof value === 'bigint' ? Number(value) : typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function asTxHash(value: unknown): string | null {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{64}$/.test(value) ? value : null
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), ms)
    }),
  ])
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function topicToId(topic: unknown): string | null {
  if (typeof topic !== 'string' || !topic.startsWith('0x')) return null
  try {
    return BigInt(topic).toString()
  } catch {
    return null
  }
}

function topicForUint(id: bigint): `0x${string}` {
  return `0x${id.toString(16).padStart(64, '0')}`
}

async function blockscoutLogs(
  address: Address,
  topic0: `0x${string}`,
  extra?: Record<string, string>
): Promise<BlockscoutLog[] | null> {
  const params = new URLSearchParams({
    module: 'logs',
    action: 'getLogs',
    fromBlock: '0',
    toBlock: 'latest',
    address,
    topic0,
    ...extra,
  })
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(`${BLOCKSCOUT_LOGS_URL}?${params.toString()}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(LOG_TIMEOUT_MS),
      })
      if (!res.ok) {
        await sleep(1500 * (attempt + 1))
        continue
      }
      const data = (await res.json()) as { status?: unknown; message?: unknown; result?: unknown }
      if (Array.isArray(data.result)) return data.result as BlockscoutLog[]
      const message = typeof data.message === 'string' ? data.message.toLowerCase() : ''
      if (message.includes('too many')) {
        await sleep(2000 * (attempt + 1))
        continue
      }
      return []
    } catch {
      await sleep(1500 * (attempt + 1))
    }
  }
  return null
}

function txMapFromLogs(logs: BlockscoutLog[], topicIndex: 1 | 2): Map<string, string> {
  const map = new Map<string, string>()
  for (const log of logs) {
    const topics = Array.isArray(log.topics) ? log.topics : []
    const id = topicToId(topics[topicIndex])
    const hash = asTxHash(log.transactionHash)
    if (!id || !hash || map.has(id)) continue
    map.set(id, hash)
  }
  return map
}

let txMapsMemory: { address: string; maps: ProofTxMaps; at: number } | null = null

const fetchProofTxMaps = cache(async (address: Address): Promise<ProofTxMaps> => {
  if (
    txMapsMemory &&
    txMapsMemory.address.toLowerCase() === address.toLowerCase() &&
    Date.now() - txMapsMemory.at < 5 * 60_000
  ) {
    return txMapsMemory.maps
  }
  const [reviewLogs, claimLogs] = await Promise.all([
    blockscoutLogs(address, toEventSelector(SUBMISSION_APPROVED)),
    blockscoutLogs(address, toEventSelector(BONUS_CLAIMED)),
  ])
  if (reviewLogs == null && claimLogs == null) {
    return { review: new Map(), claim: new Map() }
  }
  const maps: ProofTxMaps = {
    review: txMapFromLogs(reviewLogs ?? [], 1),
    claim: txMapFromLogs(claimLogs ?? [], 2),
  }
  if (maps.review.size > 0 || maps.claim.size > 0) {
    txMapsMemory = { address, maps, at: Date.now() }
  }
  return maps
})

async function perIdEventTx(
  address: Address,
  topic0: `0x${string}`,
  topicIndex: 1 | 2,
  submissionId: bigint
): Promise<string | null> {
  const extra = {
    [`topic${topicIndex}`]: topicForUint(submissionId),
    [`topic0_${topicIndex}_opr`]: 'and',
  }
  const logs = await blockscoutLogs(address, topic0, extra)
  return asTxHash(logs?.[0]?.transactionHash)
}

async function fetchImpactContributors(hash: string): Promise<string[]> {
  const cid = hash.replace(/^ipfs:\/\//i, '').split('?')[0].split('#')[0].trim()
  if (!cid) return []
  try {
    const { response } = await fetchFromIpfsGateways(cid, { timeoutMs: 8_000 })
    const text = await response.text()
    if (!text || text.trim().startsWith('<')) return []
    const json = JSON.parse(text) as { contributors?: unknown }
    return parseContributorIdentities(json.contributors)
  } catch {
    return []
  }
}

export const fetchProofOnchainReview = cache(
  async (
    submissionId: string,
    options?: { perIdLogs?: boolean }
  ): Promise<ProofOnchainReview | null> => {
    const idText = submissionId.trim()
    if (!/^\d+$/.test(idText)) return null
    const celo = CHAIN_CONFIGS[CELO_MAINNET_CHAIN_ID]
    const submission = celo.contracts.VERIFICATION as Address | undefined
    if (!submission) return null

    try {
      const client = createPublicClient({
        chain: defineChain({
          id: CELO_MAINNET_CHAIN_ID,
          name: celo.name,
          nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
          rpcUrls: { default: { http: [celo.rpcUrl] } },
        }),
        transport: http(celo.rpcUrl, { timeout: 8_000 }),
      })
      const [result, txMaps] = await Promise.all([
        client.readContract({
          address: submission,
          abi: SUBMISSION_ABI,
          functionName: 'getSubmissionDetails',
          args: [BigInt(idText)],
        }),
        fetchProofTxMaps(submission),
      ])
      const organizer = asWallet(result.submitter)
      const reviewer = asWallet(result.approver)
      const reviewedAtUnix = asUnix(result.processedTimestamp) ?? asUnix(result.timestamp)
      const impactCid =
        typeof result.impactFormDataHash === 'string' ? result.impactFormDataHash : ''
      const contributors =
        result.hasImpactForm && impactCid
          ? await withTimeout(fetchImpactContributors(impactCid), IPFS_TIMEOUT_MS, [])
          : []

      let reviewTxHash = txMaps.review.get(idText) ?? null
      let claimTxHash = txMaps.claim.get(idText) ?? null
      if (options?.perIdLogs && (!reviewTxHash || !claimTxHash)) {
        const id = BigInt(idText)
        const [reviewFallback, claimFallback] = await Promise.all([
          reviewTxHash
            ? Promise.resolve(null)
            : perIdEventTx(submission, toEventSelector(SUBMISSION_APPROVED), 1, id),
          claimTxHash
            ? Promise.resolve(null)
            : perIdEventTx(submission, toEventSelector(BONUS_CLAIMED), 2, id),
        ])
        reviewTxHash = reviewTxHash ?? reviewFallback
        claimTxHash = claimTxHash ?? claimFallback
      }

      if (
        !organizer &&
        !reviewer &&
        !reviewTxHash &&
        !claimTxHash &&
        contributors.length === 0
      ) {
        return null
      }

      return {
        organizer,
        reviewer,
        reviewedAtUnix,
        reviewTxHash,
        claimTxHash,
        contributors,
      }
    } catch {
      return null
    }
  }
)
