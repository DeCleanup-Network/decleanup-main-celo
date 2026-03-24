/**
 * Server-side aggregation for /api/impact (Carbon Copy SDG tracker).
 * Reads Submission + ERC20 Transfer logs via viem public clients.
 */
import {
  type Address,
  type Log,
  type PublicClient,
  createPublicClient,
  formatEther,
  http,
  parseAbiItem,
  zeroAddress,
} from 'viem'
import { base, celo } from 'viem/chains'

const submissionCreated = parseAbiItem(
  'event SubmissionCreated(uint256 indexed submissionId, address indexed submitter, string dataURI, uint256 timestamp)'
)
const submissionApproved = parseAbiItem(
  'event SubmissionApproved(uint256 indexed submissionId, address indexed approver, uint256 timestamp)'
)
const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
)

type TrackedEvent = typeof submissionCreated | typeof submissionApproved | typeof transferEvent

export type ChainFetchStatus = { ok: true } | { ok: false; error: string }

export type ChainMetrics = {
  cleanupsVerified: number
  participantAddresses: Set<string>
  /** Sum of minted tokens (Transfer from zero), wei */
  tokenMintedWei: bigint
}

function parseBlockEnv(v: string | undefined, fallback: bigint): bigint {
  if (!v?.trim()) return fallback
  const t = v.trim()
  if (t.startsWith('0x') || t.startsWith('0X')) return BigInt(t)
  return BigInt(t)
}

/** Recursive bisect when RPC rejects large log ranges. */
async function getLogsSafe(
  client: PublicClient,
  address: Address,
  event: TrackedEvent,
  fromBlock: bigint,
  toBlock: bigint,
  minSpan = 5000n
): Promise<readonly Log[]> {
  if (fromBlock > toBlock) return []
  try {
    return await client.getLogs({
      address,
      event,
      fromBlock,
      toBlock,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (toBlock - fromBlock < minSpan) {
      throw new Error(`getLogs failed for blocks ${fromBlock}-${toBlock}: ${msg}`)
    }
    const mid = fromBlock + (toBlock - fromBlock) / 2n
    const a = await getLogsSafe(client, address, event, fromBlock, mid, minSpan)
    const b = await getLogsSafe(client, address, event, mid + 1n, toBlock, minSpan)
    return [...a, ...b]
  }
}

async function sumMintTransfers(
  client: PublicClient,
  token: Address,
  fromBlock: bigint,
  toBlock: bigint
): Promise<bigint> {
  const logs = await getLogsSafe(client, token, transferEvent, fromBlock, toBlock)
  let wei = 0n
  for (const log of logs) {
    if (!('args' in log) || !log.args) continue
    const { from, value } = log.args as { from: Address; value: bigint }
    if (from?.toLowerCase?.() === zeroAddress.toLowerCase() && value != null) {
      wei += value
    }
  }
  return wei
}

export async function fetchChainMetrics(
  rpcUrl: string,
  chain: typeof celo | typeof base,
  submissionContract: Address | undefined,
  tokenContract: Address | undefined,
  fromBlock: bigint
): Promise<{ metrics: ChainMetrics; submission: ChainFetchStatus; token: ChainFetchStatus }> {
  const empty: ChainMetrics = {
    cleanupsVerified: 0,
    participantAddresses: new Set(),
    tokenMintedWei: 0n,
  }

  const client = createPublicClient({
    chain,
    transport: http(rpcUrl, { batch: true, timeout: 60_000 }),
  })

  let latest: bigint
  try {
    latest = await client.getBlockNumber()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      metrics: empty,
      submission: { ok: false, error: msg },
      token: { ok: false, error: msg },
    }
  }

  const start = fromBlock > latest ? 0n : fromBlock

  let submissionStatus: ChainFetchStatus = submissionContract
    ? { ok: true }
    : { ok: false, error: 'Submission contract address not configured' }

  let createdLogs: readonly Log[] = []
  let approvedLogs: readonly Log[] = []

  if (submissionContract) {
    try {
      ;[createdLogs, approvedLogs] = await Promise.all([
        getLogsSafe(client, submissionContract, submissionCreated, start, latest),
        getLogsSafe(client, submissionContract, submissionApproved, start, latest),
      ])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      submissionStatus = { ok: false, error: msg }
    }
  }

  const idToSubmitter = new Map<string, string>()
  for (const log of createdLogs) {
    if (!('args' in log) || !log.args) continue
    const args = log.args as { submissionId?: bigint; submitter?: Address }
    if (args.submissionId != null && args.submitter) {
      idToSubmitter.set(args.submissionId.toString(), args.submitter.toLowerCase())
    }
  }

  const approvedIds = new Set<string>()
  for (const log of approvedLogs) {
    if (!('args' in log) || !log.args) continue
    const args = log.args as { submissionId?: bigint }
    if (args.submissionId != null) approvedIds.add(args.submissionId.toString())
  }

  const participantAddresses = new Set<string>()
  for (const id of approvedIds) {
    const s = idToSubmitter.get(id)
    if (s) participantAddresses.add(s)
  }

  let tokenWei = 0n
  let tokenStatus: ChainFetchStatus = { ok: true }

  if (tokenContract) {
    try {
      tokenWei = await sumMintTransfers(client, tokenContract, start, latest)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      tokenStatus = { ok: false, error: msg }
    }
  } else {
    tokenStatus = { ok: false, error: 'Token contract address not configured' }
  }

  return {
    metrics: {
      cleanupsVerified: approvedIds.size,
      participantAddresses,
      tokenMintedWei: tokenWei,
    },
    submission: submissionStatus,
    token: tokenStatus,
  }
}

export function envOr(
  primary: string | undefined,
  ...fallbacks: (string | undefined)[]
): string | undefined {
  if (primary?.trim()) return primary.trim()
  for (const f of fallbacks) {
    if (f?.trim()) return f.trim()
  }
  return undefined
}

export function getImpactApiConfig() {
  const celoRpc = envOr(
    process.env.IMPACT_STATS_CELO_RPC_URL,
    process.env.NEXT_PUBLIC_RPC_URL,
    'https://forno.celo.org'
  )
  const baseRpc = envOr(process.env.IMPACT_STATS_BASE_RPC_URL, 'https://mainnet.base.org')

  const celoSubmission = envOr(
    process.env.IMPACT_STATS_CELO_SUBMISSION_CONTRACT,
    process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT
  ) as Address | undefined

  const baseSubmission = envOr(process.env.IMPACT_STATS_BASE_SUBMISSION_CONTRACT) as Address | undefined

  const celoCdcu = envOr(
    process.env.IMPACT_STATS_CELO_CDCU_CONTRACT,
    process.env.NEXT_PUBLIC_CDCU_TOKEN_ADDRESS,
    process.env.NEXT_PUBLIC_DCU_TOKEN_CONTRACT
  ) as Address | undefined

  const baseBdcu = envOr(
    process.env.IMPACT_STATS_BASE_BDCU_CONTRACT,
    process.env.NEXT_PUBLIC_BASE_BDCU_TOKEN_CONTRACT
  ) as Address | undefined

  const celoFromBlock = parseBlockEnv(process.env.IMPACT_STATS_CELO_FROM_BLOCK, 0n)
  const baseFromBlock = parseBlockEnv(process.env.IMPACT_STATS_BASE_FROM_BLOCK, 0n)

  return {
    celoRpc,
    baseRpc,
    celoSubmission,
    baseSubmission,
    celoCdcu,
    baseBdcu,
    celoFromBlock,
    baseFromBlock,
  }
}

export function tokenWeiToNumber(wei: bigint): number {
  const s = formatEther(wei)
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}
