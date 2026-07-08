import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

/** Align with Nginx `client_max_body_size` in VPS_SECURITY_PROTOCOL §2.2 */
export const MAX_MULTIPART_BODY_BYTES = 12 * 1024 * 1024
/** Optional cleanup video (MP4/MOV), separate from photo cap. */
export const MAX_CLEANUP_VIDEO_BYTES = 20 * 1024 * 1024

const ALLOWED_VIDEO_MIME = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
])

/** JSON POST bodies for verification / config APIs */
export const MAX_JSON_BODY_BYTES = 256 * 1024

/** JSON-RPC proxy: batches stay small */
export const MAX_RPC_PROXY_BODY_BYTES = 1024 * 1024

export function rejectIfContentLengthExceeds(
  request: NextRequest,
  maxBytes: number
): NextResponse | null {
  const raw = request.headers.get('content-length')
  if (raw == null || raw === '') return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) {
    return NextResponse.json({ error: 'Invalid Content-Length' }, { status: 400 })
  }
  if (n > maxBytes) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }
  return null
}

function isJsonContentType(request: NextRequest): boolean {
  const ct = (request.headers.get('content-type') || '').toLowerCase().trim()
  if (!ct) return true
  return ct.includes('application/json') || ct.includes('text/plain')
}

export async function parseJsonBody<T extends z.ZodType>(
  request: NextRequest,
  schema: T,
  options?: {
    maxBytes?: number
    /** Default true: require Content-Type to include application/json */
    requireJsonContentType?: boolean
  }
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }> {
  const maxBytes = options?.maxBytes ?? MAX_JSON_BODY_BYTES
  const requireJson = options?.requireJsonContentType !== false

  const tooLarge = rejectIfContentLengthExceeds(request, maxBytes)
  if (tooLarge) return { ok: false, response: tooLarge }

  if (requireJson && !isJsonContentType(request)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 415 }
      ),
    }
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    }
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      path: i.path.map(String).join('.') || '(root)',
      message: i.message,
    }))
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid request body', issues },
        { status: 400 }
      ),
    }
  }

  return { ok: true, data: parsed.data as z.infer<T> }
}

/** Cleanup photo uploads: match server conversion + Pinata expectations */
const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
])

export function isAllowedCleanupImageMime(file: File): boolean {
  const t = (file.type || '').toLowerCase().trim()
  if (ALLOWED_IMAGE_MIME.has(t)) return true
  if (t === 'application/octet-stream' || t === '') {
    const name = (file.name || '').toLowerCase()
    return /\.(jpe?g|png|heic|heif|webp)$/.test(name)
  }
  return false
}

export function isAllowedCleanupVideoMime(file: File): boolean {
  const t = (file.type || '').toLowerCase().trim()
  if (ALLOWED_VIDEO_MIME.has(t)) return true
  if (t === 'application/octet-stream' || t === '') {
    const name = (file.name || '').toLowerCase()
    return /\.(mp4|mov|webm|m4v)$/.test(name)
  }
  return false
}

/** JSON blobs pinned via the same multipart route (impact reports, hypercert metadata, etc.) */
export function isAllowedPinataJsonFile(file: File): boolean {
  const name = (file.name || '').toLowerCase()
  if (!name.endsWith('.json')) return false
  const t = (file.type || '').toLowerCase().trim()
  if (t === 'application/json' || t === 'text/json') return true
  if (t === 'application/octet-stream' || t === '') return true
  return false
}

/** submissionId is used as an on-disk directory name — restrict to the same safe charset as the photo-serving route to block path traversal. */
export const mlSubmissionId = z
  .coerce.string()
  .min(1)
  .max(256)
  .regex(/^[a-zA-Z0-9-_]+$/, 'submissionId may only contain letters, numbers, dashes and underscores')

export const mlVerifyBodySchema = z.object({
  submissionId: mlSubmissionId,
  beforeImageCid: z.string().min(1).max(512),
  afterImageCid: z.string().min(1).max(512),
  walletAddress: z.string().max(128).optional(),
  wallet: z.string().max(128).optional(),
  address: z.string().max(128).optional(),
})

export const mlRescoreBodySchema = z.object({
  submissionId: mlSubmissionId,
  /** When false, skip HEIC→JPEG rewrite (photos already normalized). Default true. */
  normalizePhotos: z.boolean().optional(),
  walletAddress: z.string().max(128).optional(),
  wallet: z.string().max(128).optional(),
  address: z.string().max(128).optional(),
})

const pinataMetadataValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
])

export const pinataMetadataJsonSchema = z
  .object({
    name: z.string().optional(),
    keyvalues: z.record(z.string(), pinataMetadataValue).optional(),
  })
  .passthrough()

export const pinataOptionsJsonSchema = z
  .object({
    cidVersion: z.number().optional(),
    wrapWithDirectory: z.boolean().optional(),
  })
  .passthrough()
