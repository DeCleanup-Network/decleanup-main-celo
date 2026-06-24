import { NextRequest, NextResponse } from 'next/server'
import type { Agent } from 'undici'
import { Agent as UndiciAgent } from 'undici'
import { convertHeicToJpegIfNeeded } from '@/lib/server/convert-heic-for-pinata'
import { checkInMemoryRateLimit, getRateLimitKey, tooManyRequestsResponse } from '@/lib/server/rate-limit'
import {
  MAX_CLEANUP_VIDEO_BYTES,
  MAX_MULTIPART_BODY_BYTES,
  isAllowedCleanupImageMime,
  isAllowedCleanupVideoMime,
  isAllowedPinataJsonFile,
  pinataMetadataJsonSchema,
  pinataOptionsJsonSchema,
  rejectIfContentLengthExceeds,
} from '@/lib/server/api-request-guards'

/** Node's fetch (undici) supports `dispatcher`; DOM RequestInit types do not. */
type UndiciRequestInit = RequestInit & { dispatcher?: Agent }

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Hard cap for end-to-end Pinata upload (body + Pinata processing) */
const PINATA_UPLOAD_TIMEOUT_MS = 180_000
const PINATA_AUTH_TEST_TIMEOUT_MS = 30_000

/** Pinata uploads from constrained VPS networks often hit undici UND_ERR_CONNECT_TIMEOUT at defaults. */
const pinataDispatcher = new UndiciAgent({
  connectTimeout: 90_000,
  bodyTimeout: 180_000,
  headersTimeout: 120_000,
})

/**
 * API Route to proxy IPFS uploads to Pinata
 * This avoids CORS issues and keeps API keys server-side
 */
function getPinataUploadHeaders(): HeadersInit | null {
  const jwt = (process.env.PINATA_JWT || '').trim()
  if (jwt) {
    return { Authorization: `Bearer ${jwt}` }
  }

  const apiKey = (
    process.env.PINATA_API_KEY ||
    process.env.NEXT_PUBLIC_PINATA_API_KEY ||
    ''
  ).trim()
  const secret = (
    process.env.PINATA_SECRET_KEY ||
    process.env.PINATA_SECRET_API_KEY ||
    process.env.NEXT_PUBLIC_PINATA_SECRET_KEY ||
    process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY ||
    ''
  ).trim()

  // Current Pinata docs: pinFileToIPFS uses Bearer JWT. Single token often stored as "API Key".
  if (apiKey.startsWith('eyJ')) {
    return { Authorization: `Bearer ${apiKey}` }
  }

  if (apiKey && secret) {
    return {
      pinata_api_key: apiKey,
      pinata_secret_api_key: secret,
    }
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const walletAddress =
      request.headers.get('x-wallet-address') ||
      request.headers.get('x-address') ||
      null
    // Two parallel photo POSTs per submission + retries burn budget fast at 10/min.
    const rateLimit = checkInMemoryRateLimit({
      key: getRateLimitKey(request, walletAddress),
      maxRequests: 30,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return tooManyRequestsResponse(rateLimit.resetAt)
    }

    const tooLarge = rejectIfContentLengthExceeds(
      request,
      Math.max(MAX_MULTIPART_BODY_BYTES, MAX_CLEANUP_VIDEO_BYTES)
    )
    if (tooLarge) return tooLarge

    const pinataHeaders = getPinataUploadHeaders()

    if (!pinataHeaders) {
      console.error('Pinata auth missing. Set PINATA_JWT (recommended) or PINATA_API_KEY+PINATA_SECRET_KEY.', {
        PINATA_JWT: !!process.env.PINATA_JWT,
        PINATA_API_KEY: !!process.env.PINATA_API_KEY,
        PINATA_SECRET_KEY: !!process.env.PINATA_SECRET_KEY,
        PINATA_SECRET_API_KEY: !!process.env.PINATA_SECRET_API_KEY,
      })
      return NextResponse.json(
        {
          error:
            'Pinata not configured. Set PINATA_JWT in .env.local (from Pinata dashboard API Keys — use the JWT), or legacy PINATA_API_KEY and PINATA_SECRET_KEY. See ENV_TEMPLATE.md.',
        },
        { status: 500 }
      )
    }

    // Get the form data from the request
    const formData = await request.formData()
    const file = formData.get('file') as File
    const metadataStr = formData.get('metadata') as string | null
    const optionsStr = formData.get('options') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    const isJsonUpload = isAllowedPinataJsonFile(file)
    const isVideoUpload = isAllowedCleanupVideoMime(file)
    if (!isAllowedCleanupImageMime(file) && !isJsonUpload && !isVideoUpload) {
      return NextResponse.json(
        {
          error:
            'Unsupported file type. Use JPEG, PNG, HEIC/HEIF, WebP, MP4/MOV (video), or a .json file (application/json) for metadata.',
        },
        { status: 415 }
      )
    }

    const maxBytes = isVideoUpload ? MAX_CLEANUP_VIDEO_BYTES : MAX_MULTIPART_BODY_BYTES
    if (file.size > maxBytes) {
      return NextResponse.json({ error: 'File too large' }, { status: 413 })
    }

    let fileForPinata: File
    if (isJsonUpload) {
      const text = await file.text()
      try {
        JSON.parse(text)
      } catch {
        return NextResponse.json({ error: 'Invalid JSON file content' }, { status: 400 })
      }
      fileForPinata = new File([text], file.name, {
        type: file.type || 'application/json',
      })
    } else if (isVideoUpload) {
      fileForPinata = file
    } else {
      try {
        fileForPinata = await convertHeicToJpegIfNeeded(file)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('Server HEIC→JPEG conversion failed:', msg)
        return NextResponse.json(
          {
            error:
              'Could not convert HEIC/HEIF on the server. Try a JPEG or PNG, or ensure sharp/libvips HEIC support is installed on this host.',
          },
          { status: 422 }
        )
      }
    }

    // Create new FormData for Pinata
    const pinataFormData = new FormData()
    pinataFormData.append('file', fileForPinata)

    // Parse and add metadata if provided
    if (metadataStr) {
      let metadata: unknown
      try {
        metadata = JSON.parse(metadataStr)
      } catch {
        return NextResponse.json({ error: 'metadata must be valid JSON' }, { status: 400 })
      }
      const metaParsed = pinataMetadataJsonSchema.safeParse(metadata)
      if (!metaParsed.success) {
        return NextResponse.json({ error: 'Invalid metadata shape' }, { status: 400 })
      }
      pinataFormData.append('pinataMetadata', JSON.stringify(metaParsed.data))
    } else {
      // Default metadata if not provided
      const defaultMetadata = {
        name: fileForPinata.name,
        keyvalues: {
          type: isJsonUpload ? 'json-metadata' : isVideoUpload ? 'cleanup-video' : 'cleanup-photo',
          timestamp: new Date().toISOString(),
        },
      }
      pinataFormData.append('pinataMetadata', JSON.stringify(defaultMetadata))
    }

    // Parse and add options if provided
    if (optionsStr) {
      let options: unknown
      try {
        options = JSON.parse(optionsStr)
      } catch {
        return NextResponse.json({ error: 'options must be valid JSON' }, { status: 400 })
      }
      const optParsed = pinataOptionsJsonSchema.safeParse(options)
      if (!optParsed.success) {
        return NextResponse.json({ error: 'Invalid options shape' }, { status: 400 })
      }
      pinataFormData.append('pinataOptions', JSON.stringify(optParsed.data))
    } else {
      // Default options
      const defaultOptions = {
        cidVersion: 1,
        wrapWithDirectory: false,
      }
      pinataFormData.append('pinataOptions', JSON.stringify(defaultOptions))
    }

    // Upload to Pinata (Bearer JWT is what Pinata documents for pinFileToIPFS today)
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: pinataHeaders,
      body: pinataFormData,
      dispatcher: pinataDispatcher,
      signal: AbortSignal.timeout(PINATA_UPLOAD_TIMEOUT_MS),
    } as UndiciRequestInit)

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as Record<string, unknown>
      console.error('Pinata upload error:', errorData)
      const errObj = errorData.error
      const rawReason =
        (typeof errObj === 'object' &&
          errObj !== null &&
          'reason' in errObj &&
          typeof (errObj as { reason?: unknown }).reason === 'string' &&
          (errObj as { reason: string }).reason) ||
        (typeof errObj === 'string' ? errObj : null) ||
        (typeof errorData.message === 'string' ? errorData.message : null) ||
        response.statusText ||
        'Failed to upload to IPFS'
      const upper = String(rawReason).toUpperCase()
      const credentialRejected =
        upper.includes('INVALID_CREDENTIALS') ||
        upper.includes('INVALID API KEY') ||
        response.status === 401 ||
        response.status === 403
      const userMsg = credentialRejected
        ? 'Pinata rejected this request (invalid API credentials). Regenerate PINATA_JWT in the Pinata dashboard and set it on the server that runs this API (Vercel env or VPS .env.local), then restart the app process.'
        : String(rawReason)
      return NextResponse.json(
        { error: userMsg, pinataStatus: response.status },
        { status: credentialRejected ? 502 : response.status || 500 }
      )
    }

    const data = await response.json()
    const ipfsHash = data.IpfsHash || data.hash || data.cid

    if (!ipfsHash) {
      return NextResponse.json(
        { error: 'No IPFS hash returned from Pinata' },
        { status: 500 }
      )
    }

    // Construct IPFS URL
    const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs/'
    const ipfsUrl = `${gateway}${ipfsHash}`

    return NextResponse.json({
      hash: ipfsHash,
      url: ipfsUrl,
    })
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException & { cause?: { code?: string; message?: string } }
    const msg = err?.message || String(error)
    const causeCode = err?.cause?.code || err?.code
    console.error('IPFS upload API error:', msg, { code: causeCode, cause: err?.cause })

    let userMessage = msg
    if (msg.includes('fetch failed') || msg.includes('Network') || causeCode) {
      if (causeCode === 'ENOTFOUND') {
        userMessage =
          'Server cannot resolve api.pinata.cloud (DNS). On the VPS run: getent hosts api.pinata.cloud — fix DNS or outbound rules.'
      } else if (causeCode === 'ECONNREFUSED' || causeCode === 'ECONNRESET') {
        userMessage =
          'Server connection to Pinata was refused or reset. Check VPS firewall / outbound HTTPS (443) to api.pinata.cloud.'
      } else if (causeCode === 'ETIMEDOUT' || causeCode === 'UND_ERR_CONNECT_TIMEOUT') {
        userMessage =
          'Server timed out connecting to Pinata. Check VPS network, firewall, or try again.'
      } else {
        userMessage =
          'Server could not reach Pinata (upload runs on the VPS, not your phone). Ensure this host can access https://api.pinata.cloud and PINATA_JWT is set in the server .env / PM2 env. Open GET /api/ipfs/upload on this host for a diagnostic.'
      }
    } else if (msg.includes('API keys')) {
      userMessage =
        'Pinata API keys not configured. Set PINATA_JWT (or legacy key+secret) on the server — see GET /api/ipfs/upload diagnostic.'
    }

    return NextResponse.json({ error: userMessage, code: causeCode ? String(causeCode) : undefined }, { status: 500 })
  }
}

/**
 * GET: whether this server process sees Pinata env (no secrets returned).
 * Open in browser: https://YOUR_HOST/api/ipfs/upload
 */
export async function GET() {
  const headers = getPinataUploadHeaders()
  if (!headers) {
    return NextResponse.json({
      pinataEnv: 'missing',
      authMode: 'none',
      hint:
        'This SERVER has no PINATA_* in process.env. Put PINATA_JWT in /var/www/decleanup/frontend/.env.local on the VPS (not only on your Mac), then: pm2 restart decleanup --update-env',
    })
  }
  const pinataAuth = headers
  const h = pinataAuth as Record<string, string>
  const authMode = h.Authorization ? 'jwt' : 'legacy'

  let pinataReachable: 'unknown' | 'ok' | 'failed' = 'unknown'
  let pinataTestStatus: number | null = null
  let pinataTestError: string | null = null

  try {
    const test = await fetch('https://api.pinata.cloud/data/testAuthentication', {
      method: 'GET',
      headers: pinataAuth,
      cache: 'no-store',
      dispatcher: pinataDispatcher,
      signal: AbortSignal.timeout(PINATA_AUTH_TEST_TIMEOUT_MS),
    } as UndiciRequestInit)
    pinataTestStatus = test.status
    pinataReachable = 'ok'
    if (!test.ok) {
      const body = await test.text().catch(() => '')
      pinataTestError = body.slice(0, 200) || test.statusText
    }
  } catch (e: unknown) {
    pinataReachable = 'failed'
    const ce = e as NodeJS.ErrnoException & { cause?: { code?: string } }
    pinataTestError = ce?.cause?.code || ce?.code || ce?.message || String(e)
  }

  return NextResponse.json({
    pinataEnv: 'present',
    authMode,
    pinataReachable,
    pinataTestStatus,
    pinataTestError,
    hint:
      pinataReachable === 'failed'
        ? 'Fetch from this server to api.pinata.cloud failed. Fix outbound HTTPS/DNS on the VPS, or Pinata outage.'
        : pinataTestStatus && pinataTestStatus !== 200
          ? pinataTestStatus === 403 || pinataTestStatus === 401
            ? 'Pinata rejected credentials (403/401). Regenerate PINATA_JWT in Pinata dashboard and set it on this server (Vercel env or VPS .env.local), then restart.'
            : 'Credentials rejected by Pinata or wrong tier — regenerate JWT in Pinata dashboard.'
          : authMode === 'legacy'
            ? 'Using key+secret. Prefer PINATA_JWT (Bearer) from Pinata API Keys page.'
            : 'JWT accepted by Pinata test endpoint. If POST /api/ipfs/upload still fails, check file size limits or PM2 logs.',
  })
}
