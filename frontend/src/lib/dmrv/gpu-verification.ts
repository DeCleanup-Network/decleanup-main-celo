/**
 * GPU verification: calls the inference service (YOLOv8 / waste detection),
 * applies the product scoring formula, and hashes results for audit / on-chain use.
 *
 * Env:
 * - GPU_INFERENCE_SERVICE_URL — base URL (e.g. http://127.0.0.1:8000)
 * - GPU_SHARED_SECRET — sent as Authorization: Bearer <secret> when non-empty
 * - GPU_INFERENCE_PATH — optional path segment (default /infer)
 */

import { createHash } from 'crypto'

const DEFAULT_INFER_PATH = '/infer'
const INFER_TIMEOUT_MS = 120_000

export interface VerificationResult {
  beforeInference: {
    objectCount: number
    meanConfidence: number
  }
  afterInference: {
    objectCount: number
    meanConfidence: number
  }
  score: {
    delta: number
    score: number
    verdict: 'approved' | 'rejected' | 'pending'
  }
  hash: string
}

interface RawInferPayload {
  object_count?: number
  objectCount?: number
  mean_confidence?: number
  meanConfidence?: number
  objects?: unknown[]
  detections?: unknown[]
}

function getGpuBaseUrl(): string {
  const raw = process.env.GPU_INFERENCE_SERVICE_URL || 'http://localhost:8000'
  return raw.replace(/\/+$/, '')
}

function getInferUrl(): string {
  const path = process.env.GPU_INFERENCE_PATH || DEFAULT_INFER_PATH
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${getGpuBaseUrl()}${normalized}`
}

function getAuthHeaders(): HeadersInit {
  const secret = process.env.GPU_SHARED_SECRET || ''
  if (!secret) return {}
  return { Authorization: `Bearer ${secret}` }
}

function parseInferResponse(data: unknown): { objectCount: number; meanConfidence: number } {
  if (!data || typeof data !== 'object') {
    return { objectCount: 0, meanConfidence: 0 }
  }
  const o = data as RawInferPayload
  const objects = Array.isArray(o.objects) ? o.objects : []
  const detections = Array.isArray(o.detections) ? o.detections : []
  const objectCount =
    typeof o.object_count === 'number'
      ? o.object_count
      : typeof o.objectCount === 'number'
        ? o.objectCount
        : objects.length > 0
          ? objects.length
          : detections.length
  const meanConfidence =
    typeof o.mean_confidence === 'number'
      ? o.mean_confidence
      : typeof o.meanConfidence === 'number'
        ? o.meanConfidence
        : 0
  return {
    objectCount: Math.max(0, Math.floor(objectCount)),
    meanConfidence: clamp01(meanConfidence),
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

/**
 * POST multipart image to GPU service /infer (or GPU_INFERENCE_PATH).
 */
export async function inferImage(imageUrl: string): Promise<{ objectCount: number; meanConfidence: number }> {
  const imageRes = await fetch(imageUrl, {
    signal: AbortSignal.timeout(INFER_TIMEOUT_MS),
  })
  if (!imageRes.ok) {
    throw new Error(`Failed to download image for inference: ${imageRes.status} ${imageUrl}`)
  }
  const contentType = imageRes.headers.get('content-type') || 'image/jpeg'
  const arrayBuffer = await imageRes.arrayBuffer()
  const blob = new Blob([arrayBuffer], { type: contentType })

  const form = new FormData()
  form.append('file', blob, 'image.jpg')

  const inferRes = await fetch(getInferUrl(), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: form,
    signal: AbortSignal.timeout(INFER_TIMEOUT_MS),
  })

  if (!inferRes.ok) {
    const text = await inferRes.text().catch(() => '')
    throw new Error(`GPU infer failed: ${inferRes.status} ${inferRes.statusText} ${text.slice(0, 500)}`)
  }

  const json: unknown = await inferRes.json()
  return parseInferResponse(json)
}

/**
 * Product scoring (see docs/DEVELOPER_SPECS.md — ML Verification Flow).
 * trashDelta = beforeCount - afterCount; higher means more waste removed.
 */
export function computeVerificationScore(
  before: { objectCount: number; meanConfidence: number },
  after: { objectCount: number; meanConfidence: number },
  impactDataBoost = 0
): { delta: number; score: number; verdict: 'approved' | 'rejected' | 'pending' } {
  const delta = before.objectCount - after.objectCount
  const normalizedTrashDelta = Math.min(Math.max(delta, 0) / 50, 1)
  const meanConfidence = (before.meanConfidence + after.meanConfidence) / 2
  const boost = clamp01(impactDataBoost)
  const score = meanConfidence * 0.3 + normalizedTrashDelta * 0.7 + boost
  const clampedScore = clamp01(score)

  let verdict: 'approved' | 'rejected' | 'pending'
  if (clampedScore >= 0.35) verdict = 'approved'
  else if (clampedScore >= 0.15) verdict = 'pending'
  else verdict = 'rejected'

  return { delta, score: clampedScore, verdict }
}

/**
 * Deterministic hash for audit trails (hex, no 0x prefix; callers may prefix for bytes32).
 */
export function hashVerificationResult(result: VerificationResult, submissionId?: string): string {
  const payload = {
    submissionId: submissionId ?? null,
    beforeInference: result.beforeInference,
    afterInference: result.afterInference,
    score: result.score,
  }
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

function stubPending(submissionId: string, reason: string): VerificationResult {
  console.warn('[GPU Verification] Falling back to pending:', reason)
  const result: VerificationResult = {
    beforeInference: { objectCount: 0, meanConfidence: 0 },
    afterInference: { objectCount: 0, meanConfidence: 0 },
    score: {
      delta: 0,
      score: 0,
      verdict: 'pending',
    },
    hash: '',
  }
  result.hash = hashVerificationResult(result, submissionId)
  return result
}

/**
 * Run full verification: two inference calls + scoring + hash.
 * On GPU/network errors, returns a pending result so the API route can still respond 200.
 */
export async function runFullVerification(
  submissionId: string,
  beforeImageUrl: string,
  afterImageUrl: string,
  options?: { impactDataBoost?: number }
): Promise<VerificationResult> {
  const boost = options?.impactDataBoost ?? 0

  try {
    const [beforeInference, afterInference] = await Promise.all([
      inferImage(beforeImageUrl),
      inferImage(afterImageUrl),
    ])

    const { delta, score, verdict } = computeVerificationScore(beforeInference, afterInference, boost)

    const result: VerificationResult = {
      beforeInference: {
        objectCount: beforeInference.objectCount,
        meanConfidence: beforeInference.meanConfidence,
      },
      afterInference: {
        objectCount: afterInference.objectCount,
        meanConfidence: afterInference.meanConfidence,
      },
      score: {
        delta,
        score,
        verdict,
      },
      hash: '',
    }

    result.hash = hashVerificationResult(result, submissionId)

    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[GPU Verification] Inference or scoring failed:', message)
    return stubPending(submissionId, message)
  }
}
