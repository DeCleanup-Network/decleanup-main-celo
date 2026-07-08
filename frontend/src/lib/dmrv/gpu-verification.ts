/**
 * GPU verification: calls the inference service (YOLOv8 / waste detection),
 * applies the product scoring formula, and hashes results for audit / on-chain use.
 *
 * Env:
 * - GPU_INFERENCE_SERVICE_URL — base URL (e.g. http://127.0.0.1:8000)
 * - GPU_SHARED_SECRET — sent as Authorization: Bearer <secret> when non-empty
 * - GPU_INFERENCE_PATH — optional path segment (default /infer)
 *
 * The GPU service (gpu-inference-service/main.py) expects POST /infer with JSON:
 * { submissionId, imageUrl, phase: "before"|"after" } — it downloads the image itself.
 *
 * Scoring incorporates stability-aware logic (PR #29): negative-delta handling,
 * confidence variance, and thresholds tuned to reduce false rejections.
 */

import { createHash } from 'crypto'
import { existsSync } from 'fs'
import { join } from 'path'
import { resolveUploadDir } from '@/lib/server/resolve-upload-dir'

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
    /** Fraction of detected "before" litter that is gone in "after" (0..1). */
    reductionRatio?: number
    /** Present when computed (debug / transparency). */
    confidenceVariance?: number
    isStable?: boolean
  }
  /** GPU /health model_version that produced this result (audit: detect silent model fallback). */
  modelVersion?: string
  hash: string
}

/** Alias for API / client consumers that only reference the scored verdict block. */
export type VerificationScore = VerificationResult['score']

interface RawInferPayload {
  object_count?: number
  objectCount?: number
  mean_confidence?: number
  meanConfidence?: number
  model_version?: string
  modelVersion?: string
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

function parseInferResponse(data: unknown): {
  objectCount: number
  meanConfidence: number
  modelVersion?: string
} {
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
  const modelVersion =
    typeof o.model_version === 'string'
      ? o.model_version
      : typeof o.modelVersion === 'string'
        ? o.modelVersion
        : undefined
  return {
    objectCount: Math.max(0, Math.floor(objectCount)),
    meanConfidence: clamp01(meanConfidence),
    ...(modelVersion ? { modelVersion } : {}),
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

/** When GPU and Next.js share a host, pass filesystem paths to skip HTTP image fetch. */
function resolveLocalImagePath(submissionId: string, phase: 'before' | 'after'): string | undefined {
  const filename = `${phase}.jpg`
  const filepath = join(resolveUploadDir(), submissionId, filename)
  if (!existsSync(filepath)) return undefined
  return filepath
}

/**
 * Ask GPU service /infer to run YOLO on an image reachable at imageUrl (service downloads it).
 */
export async function inferImage(
  submissionId: string,
  phase: 'before' | 'after',
  imageUrl: string,
  localPath?: string
): Promise<{ objectCount: number; meanConfidence: number; modelVersion?: string }> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  }

  const resolvedLocal = localPath ?? resolveLocalImagePath(submissionId, phase)

  const inferRes = await fetch(getInferUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      submissionId,
      imageUrl,
      phase,
      ...(resolvedLocal ? { localPath: resolvedLocal } : {}),
    }),
    signal: AbortSignal.timeout(INFER_TIMEOUT_MS),
  })

  if (!inferRes.ok) {
    const text = await inferRes.text().catch(() => '')
    throw new Error(`GPU infer failed: ${inferRes.status} ${inferRes.statusText} ${text.slice(0, 500)}`)
  }

  const json: unknown = await inferRes.json()
  return parseInferResponse(json)
}

export interface ScoreThresholds {
  /** score ≥ this → approved. Default 0.5 (at least half the detected litter removed). */
  autoThreshold?: number
  /** score ≥ this → pending; below it with no reduction → rejected. Default 0.15. */
  reviewThreshold?: number
}

/**
 * Product scoring (see docs/ML_VERIFICATION_ARCHITECTURE.md).
 *
 * The score is the fraction of detected "before" litter that is gone in "after"
 * (`(before - after) / before`). This compares the same detector against itself on
 * the two photos, so it stays meaningful even when the model under-counts a busy field
 * (distant/small litter is routinely missed — see SAHI tiling in the GPU service). It
 * deliberately does NOT fold in the detector's absolute confidence, which for litter
 * models sits at ~0.1-0.2 and would otherwise cap every real cleanup below "approved".
 *
 * Verdicts map to the API: approved / pending / rejected. Thresholds are tunable via
 * ML_VERIFICATION_AUTO_THRESHOLD / ML_VERIFICATION_REVIEW_THRESHOLD (wired in
 * runFullVerification). Human verifiers still make the final onchain decision.
 */
export function computeVerificationScore(
  before: { objectCount: number; meanConfidence: number },
  after: { objectCount: number; meanConfidence: number },
  thresholds: ScoreThresholds = {}
): VerificationScore {
  const autoThreshold = clamp01(thresholds.autoThreshold ?? 0.5)
  const reviewThreshold = clamp01(thresholds.reviewThreshold ?? 0.15)

  const beforeCount = before.objectCount
  const afterCount = after.objectCount
  const delta = beforeCount - afterCount
  const confidenceVariance = Math.abs(before.meanConfidence - after.meanConfidence)

  // Detector saw no litter in the "before" photo — it cannot judge a cleanup it never
  // saw, so hand it to the human verifier rather than guessing from the "after" alone.
  if (beforeCount === 0) {
    return {
      delta,
      score: 0,
      verdict: 'pending',
      reductionRatio: 0,
      confidenceVariance,
      isStable: true,
    }
  }

  const reductionRatio = Math.max(-1, Math.min(1, delta / beforeCount))
  const score = clamp01(reductionRatio)

  let verdict: VerificationScore['verdict']
  if (score >= autoThreshold) verdict = 'approved'
  else if (score >= reviewThreshold) verdict = 'pending'
  // Below the review bar: only call it "rejected" when litter actually increased.
  else verdict = delta < 0 ? 'rejected' : 'pending'

  return {
    delta,
    score,
    verdict,
    reductionRatio,
    confidenceVariance,
    isStable: true,
  }
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

function scoreThresholdsFromEnv(): ScoreThresholds {
  const parse = (raw: string | undefined): number | undefined => {
    if (!raw) return undefined
    // Tolerate an inline "# comment" that some .env loaders leave attached.
    const n = Number(raw.trim().split(/\s+/)[0])
    return Number.isFinite(n) ? n : undefined
  }
  return {
    autoThreshold: parse(process.env.ML_VERIFICATION_AUTO_THRESHOLD),
    reviewThreshold: parse(process.env.ML_VERIFICATION_REVIEW_THRESHOLD),
  }
}

/**
 * Run full verification: two inference calls + scoring + hash.
 *
 * A genuine "model saw no litter" (both counts 0) is a real, scored pending result.
 * Infrastructure failures (GPU down, auth, timeout, unreachable image) THROW instead —
 * the caller returns an error status and does not persist a zeroed ml_result.json, so
 * outages stay visible and the client keeps polling for the real result.
 */
export async function runFullVerification(
  submissionId: string,
  beforeImageUrl: string,
  afterImageUrl: string
): Promise<VerificationResult> {
  try {
    const [beforeInference, afterInference] = await Promise.all([
      inferImage(submissionId, 'before', beforeImageUrl),
      inferImage(submissionId, 'after', afterImageUrl),
    ])

    const scoreBlock = computeVerificationScore(
      beforeInference,
      afterInference,
      scoreThresholdsFromEnv()
    )

    const result: VerificationResult = {
      beforeInference: {
        objectCount: beforeInference.objectCount,
        meanConfidence: beforeInference.meanConfidence,
      },
      afterInference: {
        objectCount: afterInference.objectCount,
        meanConfidence: afterInference.meanConfidence,
      },
      score: scoreBlock,
      modelVersion: beforeInference.modelVersion ?? afterInference.modelVersion,
      hash: '',
    }

    result.hash = hashVerificationResult(result, submissionId)

    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[GPU Verification] Inference failed (surfacing as error):', message)
    throw err instanceof Error ? err : new Error(message)
  }
}
