import { writeFile, readFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import type { VerificationResult } from '@/lib/dmrv/gpu-verification'
import { normalizeImageBufferToJpeg } from '@/lib/server/convert-heic-for-pinata'
import { resolveUploadDir } from '@/lib/server/resolve-upload-dir'

/** IPFS gateway fetch when pulling CIDs for ML pipeline */
export const IPFS_GATEWAY_FETCH_TIMEOUT_MS = 90_000

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
  await writeFile(filepath, imageBuffer)

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
        imageUrls,
        timestamp: Date.now(),
      },
      null,
      2
    )
  )
}

export async function downloadAndStoreFromIpfs(
  submissionId: string,
  phase: 'before' | 'after',
  ipfsCid: string,
  uploadDir?: string
): Promise<string> {
  const ipfsGateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
  const cleanCid = ipfsCid.replace(/^ipfs:\/\//, '').split('?')[0].split('#')[0]
  const ipfsUrl = `${ipfsGateway}${cleanCid}`

  const response = await fetch(ipfsUrl, {
    signal: AbortSignal.timeout(IPFS_GATEWAY_FETCH_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch image from IPFS: ${response.status}`)
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer())
  const jpegBuffer = await normalizePhotoToJpeg(imageBuffer)
  return storePhoto(submissionId, phase, jpegBuffer, uploadDir)
}
