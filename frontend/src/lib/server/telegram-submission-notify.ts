import 'server-only'
import { createPublicClient, defineChain, http, type Address } from 'viem'
import {
  CONTRACT_ADDRESSES,
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
  REQUIRED_RPC_URL,
} from '@/lib/blockchain/chain-constants'
import { getTelegramConfig } from '@/lib/server/telegram-config'
import { sendTelegramMessage } from '@/lib/server/telegram-client'
import {
  markSubmissionTelegramNotified,
  wasSubmissionTelegramNotified,
} from '@/lib/server/telegram-notification-log'

const SUBMISSION_STATUS_PENDING = 0

const SUBMISSION_DETAILS_ABI = [
  {
    type: 'function',
    name: 'getSubmissionDetails',
    stateMutability: 'view',
    inputs: [{ name: 'submissionId', type: 'uint256' }],
    outputs: [
      {
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
        type: 'tuple',
      },
    ],
  },
] as const

/** Matches `getSubmissionDetails` tuple output; asserted after `readContract`. */
type SubmissionDetailsTuple = {
  id: bigint
  submitter: Address
  dataURI: string
  beforePhotoHash: string
  afterPhotoHash: string
  impactFormDataHash: string
  latitude: bigint
  longitude: bigint
  timestamp: bigint
  status: number | bigint
  approver: Address
  processedTimestamp: bigint
  rewarded: boolean
  feePaid: bigint
  feeRefunded: boolean
  hasImpactForm: boolean
  hasRecyclables: boolean
  recyclablesPhotoHash: string
  recyclablesReceiptHash: string
}

const chain = defineChain({
  id: REQUIRED_CHAIN_ID,
  name: REQUIRED_CHAIN_NAME,
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: { default: { http: [REQUIRED_RPC_URL] } },
})

const publicClient = createPublicClient({
  chain,
  transport: http(REQUIRED_RPC_URL),
})

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function ipfsGatewayUrl(hash: string): string {
  const gateway =
    process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
  const base = gateway.endsWith('/') ? gateway : `${gateway}/`
  const clean = hash.replace(/^ipfs:\/\//, '').trim()
  return clean ? `${base}${clean}` : ''
}

function formatCoords(latScaled: bigint, lngScaled: bigint): {
  lat: number
  lng: number
  mapsUrl: string
} {
  const scale = 1_000_000
  const lat = Number(latScaled) / scale
  const lng = Number(lngScaled) / scale
  return {
    lat,
    lng,
    mapsUrl: `https://www.google.com/maps?q=${lat},${lng}`,
  }
}

function shortAddress(addr: string): string {
  if (addr.length < 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export type NotifySubmissionResult =
  | { sent: true; messageId: number }
  | { sent: false; reason: 'not_configured' | 'already_notified' | 'not_pending' | 'not_found' | 'telegram_error'; detail?: string }

/**
 * Verify submission onchain, format alert, send to verifier Telegram chat.
 */
export async function notifyVerifiersOfNewSubmission(params: {
  submissionId: string
  txHash?: string
}): Promise<NotifySubmissionResult> {
  const config = getTelegramConfig()
  if (!config) {
    return { sent: false, reason: 'not_configured' }
  }

  const submissionAddress = process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT as Address | undefined
  if (!submissionAddress) {
    return { sent: false, reason: 'not_configured', detail: 'NEXT_PUBLIC_SUBMISSION_CONTRACT missing' }
  }

  const id = BigInt(params.submissionId)
  if (id < 0n) {
    return { sent: false, reason: 'not_found' }
  }

  if (await wasSubmissionTelegramNotified(params.submissionId)) {
    return { sent: false, reason: 'already_notified' }
  }

  let details: SubmissionDetailsTuple
  try {
    details = (await publicClient.readContract({
      address: submissionAddress,
      abi: SUBMISSION_DETAILS_ABI,
      functionName: 'getSubmissionDetails',
      args: [id],
    })) as SubmissionDetailsTuple
  } catch (e) {
    console.warn('[telegram-submission-notify] readContract failed:', e)
    return { sent: false, reason: 'not_found' }
  }

  const status = Number(details.status)
  if (status !== SUBMISSION_STATUS_PENDING) {
    return { sent: false, reason: 'not_pending' }
  }

  const submitter = details.submitter as string
  const { lat, lng, mapsUrl } = formatCoords(details.latitude, details.longitude)
  const beforeUrl = ipfsGatewayUrl(details.beforePhotoHash)
  const afterUrl = ipfsGatewayUrl(details.afterPhotoHash)
  const submittedAt = new Date(Number(details.timestamp) * 1000).toISOString()

  const lines = [
    '🆕 <b>New cleanup submission</b>',
    '',
    `<b>ID:</b> #${params.submissionId}`,
    `<b>Submitter:</b> <code>${escapeHtml(submitter)}</code>`,
    `<b>When:</b> ${escapeHtml(submittedAt)}`,
    `<b>Location:</b> ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    `<a href="${mapsUrl}">Open in Google Maps</a>`,
    '',
    `<b>Impact form:</b> ${details.hasImpactForm ? 'yes' : 'no'}`,
    `<b>Recyclables:</b> ${details.hasRecyclables ? 'yes' : 'no'}`,
  ]

  if (beforeUrl) {
    lines.push('', `<a href="${beforeUrl}">Before photo</a>`)
  }
  if (afterUrl) {
    lines.push(`<a href="${afterUrl}">After photo</a>`)
  }

  lines.push(
    '',
    `<a href="${config.appBaseUrl}/verifier">Open verifier dashboard</a>`
  )

  if (params.txHash) {
    lines.push(
      `<a href="${config.blockExplorerUrl}/tx/${params.txHash}">View transaction</a>`
    )
  }

  lines.push(
    '',
    `<i>${escapeHtml(REQUIRED_CHAIN_NAME)} · ${shortAddress(submissionAddress)}</i>`
  )

  const text = lines.join('\n')

  const result = await sendTelegramMessage({
    botToken: config.botToken,
    chatId: config.verifierChatId,
    text,
    disableWebPagePreview: false,
  })

  if (!result.ok) {
    console.error('[telegram-submission-notify] send failed:', result.error)
    return { sent: false, reason: 'telegram_error', detail: result.error }
  }

  await markSubmissionTelegramNotified(params.submissionId, params.txHash)

  return { sent: true, messageId: result.messageId }
}
