import { writeFile, readFile, mkdir, rename } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import type { VerificationResult } from '@/lib/dmrv/gpu-verification'
import { normalizeImageBufferToJpeg } from '@/lib/server/convert-heic-for-pinata'
import { resolveUploadDir } from '@/lib/server/resolve-upload-dir'

/** Per-attempt IPFS gateway fetch timeout (we try several gateways, so keep each bounded). */
export const IPFS_GATEWAY_FETCH_TIMEOUT_MS = 30_000

/** Fallback public gateways tried in order after the configured one (deduped). */
const FALLBACK_IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/',
]

function ipfsGatewayList(): string[] {
  const configured = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
  const seen = new Set<string>()
  return [configured, ...FALLBACK_IPFS_GATEWAYS].filter((g) => {
    if (seen.has(g)) return false
    seen.add(g)
    return true
  })
}

export function getPublicUrlBase(): string {
  return process.env.PUBLIC_URL_BASE || 'http://localhost:3000'
}

export function submissionImageUrls(submissionId: string): { before: string; after: string } {
  const base = getPublicUrlBase()
  return {
    before: `${base}/api/uploads/${submissionId}/before.jpg`,
    after: `${base}/api/uploads/${submissionId}/after.jpg`,
  }
}

/**
 * Normalize IPFS bytes to JPEG for GPU/YOLO (handles HEIC/HEIF from mobile uploads).
 */
export async function normalizePhotoToJpeg(imageBuffer: Buffer): Promise<Buffer> {
  return normalizeImageBufferToJpeg(imageBuffer)
}

export async function storePhoto(
  submissionId: string,
  phase: 'before' | 'after',
  imageBuffer: Buffer,
  uploadDir?: string
): Promise<string> {
  const dir = uploadDir ?? resolveUploadDir()
  const submissionDir = join(dir, submissionId)
  if (!existsSync(submissionDir)) {
    await mkdir(submissionDir, { recursive: true })
  }

  const filename = `${phase}.jpg`
  const filepath = join(submissionDir, filename)
  // Write to a temp file and rename into place so an interrupted write never leaves a
  // truncated before/after photo on disk (rename is atomic within the same directory).
  const tmppath = `${filepath}.tmp`
  await writeFile(tmppath, imageBuffer)
  await rename(tmppath, filepath)

  return `${getPublicUrlBase()}/api/uploads/${submissionId}/${filename}`
}

/**
 * Re-read on-disk photos and rewrite as JPEG (fixes HEIC saved with .jpg extension).
 */
export async function normalizeExistingSubmissionPhotos(
  submissionId: string,
  uploadDir?: string
): Promise<void> {
  const dir = uploadDir ?? resolveUploadDir()
  for (const phase of ['before', 'after'] as const) {
    const filepath = join(dir, submissionId, `${phase}.jpg`)
    if (!existsSync(filepath)) {
      throw new Error(`Missing ${phase}.jpg for submission ${submissionId}`)
    }
    const raw = await readFile(filepath)
    const jpeg = await normalizePhotoToJpeg(raw)
    await writeFile(filepath, jpeg)
  }
}

export async function writeMlVerificationResult(
  submissionId: string,
  verificationResult: VerificationResult,
  imageUrls: { before: string; after: string },
  uploadDir?: string
): Promise<void> {
  const dir = uploadDir ?? resolveUploadDir()
  const resultDir = join(dir, submissionId)
  if (!existsSync(resultDir)) {
    await mkdir(resultDir, { recursive: true })
  }
  const resultFile = join(resultDir, 'ml_result.json')
  await writeFile(
    resultFile,
    JSON.stringify(
      {
        submissionId,
        score: verificationResult.score,
        hash: verificationResult.hash,
        beforeInference: verificationResult.beforeInference,
        afterInference: verificationResult.afterInference,
        modelVersion: verificationResult.modelVersion,
        imageUrls,
        timestamp: Date.now(),
      },
      null,
      2
    )
  )
}

/**
 * Fetch a CID from IPFS, trying each gateway in turn and retrying transient
 * failures (429 / 5xx / network / timeout) before moving on. Returns the raw bytes.
 * Does NOT touch disk, so a caller can fetch both photos before writing either.
 */
export async function fetchImageBufferFromIpfs(ipfsCid: string): Promise<Buffer> {
  const cleanCid = ipfsCid.replace(/^ipfs:\/\//, '').split('?')[0].split('#')[0]
  const gateways = ipfsGatewayList()
  let lastError = ''

  for (const gateway of gateways) {
    const url = `${gateway}${cleanCid}`
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(IPFS_GATEWAY_FETCH_TIMEOUT_MS),
        })
        if (response.ok) {
          return Buffer.from(await response.arrayBuffer())
        }
        lastError = `HTTP ${response.status} from ${gateway}`
        // A 4xx other than 429 won't improve on retry — skip to the next gateway.
        if (response.status !== 429 && response.status < 500) break
      } catch (err) {
        lastError = `${err instanceof Error ? err.message : String(err)} from ${gateway}`
      }
      // brief backoff before the second attempt on the same gateway
      if (attempt === 0) await new Promise((r) => setTimeout(r, 750))
    }
  }

  throw new Error(`Failed to fetch image from IPFS (${cleanCid}): ${lastError}`)
}

export async function downloadAndStoreFromIpfs(
  submissionId: string,
  phase: 'before' | 'after',
  ipfsCid: string,
  uploadDir?: string
): Promise<string> {
  const imageBuffer = await fetchImageBufferFromIpfs(ipfsCid)
  const jpegBuffer = await normalizePhotoToJpeg(imageBuffer)
  return storePhoto(submissionId, phase, jpegBuffer, uploadDir)
}

/**
 * Download both photos from IPFS and normalize to JPEG in memory, writing to disk only
 * after BOTH succeed — so a mid-way IPFS failure never leaves a fresh before.jpg paired
 * with a stale after.jpg from an earlier run.
 */
export async function downloadAndStoreBothFromIpfs(
  submissionId: string,
  beforeCid: string,
  afterCid: string,
  uploadDir?: string
): Promise<{ before: string; after: string }> {
  const [beforeRaw, afterRaw] = await Promise.all([
    fetchImageBufferFromIpfs(beforeCid),
    fetchImageBufferFromIpfs(afterCid),
  ])
  const [beforeJpeg, afterJpeg] = await Promise.all([
    normalizePhotoToJpeg(beforeRaw),
    normalizePhotoToJpeg(afterRaw),
  ])
  const before = await storePhoto(submissionId, 'before', beforeJpeg, uploadDir)
  const after = await storePhoto(submissionId, 'after', afterJpeg, uploadDir)
  return { before, after }
}
