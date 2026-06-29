import type { Agent } from '@atproto/api'
import { BlobRef } from '@atproto/lexicon'
import { getIpfsGatewayBases, normalizeIpfsCid } from '@/lib/utils/ipfs-fetch-gateways'
import { isAllowedIpfsFetchHost } from '@/lib/utils/ipfs-fetch-allowed'

const SMALL_IMAGE_MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
export const SMALL_IMAGE_LEXICON_TYPE = 'org.hypercerts.defs#smallImage'
const SMALL_IMAGE_TYPE = SMALL_IMAGE_LEXICON_TYPE

function sniffImageMime(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png'
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  return 'image/jpeg'
}

function normalizeImageMime(contentType: string | null, bytes: Uint8Array): string {
  const raw = contentType?.split(';')[0]?.trim().toLowerCase() ?? ''
  if (raw && ALLOWED_IMAGE_MIMES.has(raw)) {
    return raw === 'image/jpg' ? 'image/jpeg' : raw
  }
  return sniffImageMime(bytes)
}

async function fetchIpfsImageBytes(cid: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const normalizedCid = normalizeIpfsCid(cid)
  if (!normalizedCid) {
    throw new Error('Missing IPFS CID for cover image')
  }

  const perGatewayMs = 20_000
  let lastError = 'IPFS gateways failed'

  for (const base of getIpfsGatewayBases()) {
    const gatewayUrl = `${base}${normalizedCid}`
    let parsed: URL
    try {
      parsed = new URL(gatewayUrl)
    } catch {
      continue
    }
    if (!isAllowedIpfsFetchHost(parsed.hostname)) continue

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), perGatewayMs)
    try {
      const response = await fetch(gatewayUrl, {
        headers: { Accept: 'image/*,*/*' },
        signal: controller.signal,
        cache: 'no-store',
      })
      if (!response.ok) {
        lastError = `HTTP ${response.status} from ${parsed.hostname}`
        continue
      }

      const buf = await response.arrayBuffer()
      const bytes = new Uint8Array(buf)
      if (bytes.byteLength === 0) {
        lastError = `Empty response from ${parsed.hostname}`
        continue
      }
      if (bytes.byteLength > SMALL_IMAGE_MAX_BYTES) {
        throw new Error(`Cover image exceeds ${SMALL_IMAGE_MAX_BYTES} byte smallImage limit`)
      }

      return {
        bytes,
        mime: normalizeImageMime(response.headers.get('content-type'), bytes),
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    } finally {
      clearTimeout(timeout)
    }
  }

  throw new Error(lastError)
}

function extractIpfsCidFromActivityImage(image: unknown): string | undefined {
  if (!image || typeof image !== 'object') return undefined
  const typed = image as { $type?: string; uri?: string }
  if (typed.$type !== 'org.hypercerts.defs#uri') return undefined
  if (typeof typed.uri !== 'string' || !typed.uri.startsWith('ipfs://')) return undefined
  const cid = typed.uri.slice('ipfs://'.length).trim()
  return cid && !cid.includes('QmPlaceholder') ? cid : undefined
}

/** Normalize upload/API blob values to the BlobRef class lexicon validators expect. */
export function coerceBlobRef(value: unknown): BlobRef | null {
  if (!value) return null
  if (value instanceof BlobRef) return value

  let json: unknown = value
  if (
    typeof value === 'object' &&
    value !== null &&
    'toJSON' in value &&
    typeof (value as { toJSON: unknown }).toJSON === 'function'
  ) {
    json = (value as { toJSON: () => unknown }).toJSON()
  }

  return BlobRef.asBlobRef(json)
}

/**
 * Hypercerts lexicon blob fields require BlobRef instances (not plain JSON).
 * Coerce smallImage.image before validateRecord / createRecord.
 */
export function coerceActivityRecordBlobRefs(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const image = record.image
  if (!image || typeof image !== 'object') return record
  const typed = image as { $type?: string; image?: unknown }
  if (typed.$type !== SMALL_IMAGE_TYPE) return record

  const coerced = coerceBlobRef(typed.image)
  if (!coerced) return record

  return {
    ...record,
    image: {
      $type: SMALL_IMAGE_TYPE,
      image: coerced,
    },
  }
}

/**
 * Upload cover art to the login PDS and return org.hypercerts.defs#smallImage for activity.image.
 */
export async function buildActivitySmallImage(
  agent: Agent,
  ipfsCid: string,
): Promise<{ $type: string; image: unknown }> {
  const { bytes, mime } = await fetchIpfsImageBytes(ipfsCid)
  const blob = new Blob([Buffer.from(bytes)], { type: mime })
  const upload = await agent.uploadBlob(blob)
  const blobRef = upload.data.blob
  return {
    $type: SMALL_IMAGE_TYPE,
    image: blobRef,
  }
}

/**
 * Replace activity.image IPFS URI with a PDS blob so Hyperscan can render the cover.
 * Falls back to the original record when fetch/upload fails.
 */
export async function hydrateActivityCoverImage(
  agent: Agent,
  record: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const image = record.image
  if (image && typeof image === 'object' && (image as { $type?: string }).$type === SMALL_IMAGE_TYPE) {
    const inner = (image as { image?: unknown }).image
    if (inner instanceof BlobRef || BlobRef.asBlobRef(inner)) {
      return record
    }
  }

  const cid = extractIpfsCidFromActivityImage(image)
  if (!cid) return record

  try {
    const smallImage = await buildActivitySmallImage(agent, cid)
    return { ...record, image: smallImage }
  } catch (err) {
    console.warn('[ATProto] Cover PDS upload failed; publishing with IPFS URI:', err)
    return record
  }
}
