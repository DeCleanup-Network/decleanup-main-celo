export const MAX_CLEANUP_VIDEO_DURATION_SEC = 10
export const MAX_CLEANUP_VIDEO_BYTES = 20 * 1024 * 1024

export type VideoValidationResult =
  | { ok: true; durationSec: number; durationUnknown?: boolean }
  | {
      ok: false
      message: string
      reason?: 'too_large' | 'too_long' | 'metadata_unavailable' | 'invalid_duration'
    }

function isLikelyMobileSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

function loadVideoDuration(file: File, timeoutMs = 20_000): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.setAttribute('playsinline', 'true')
    video.setAttribute('webkit-playsinline', 'true')

    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      video.load()
      fn()
    }

    const timer = setTimeout(() => {
      finish(() => reject(new Error('timeout')))
    }, timeoutMs)

    video.onloadedmetadata = () => {
      finish(() => resolve(video.duration))
    }

    video.onerror = () => {
      finish(() => reject(new Error('metadata')))
    }

    video.src = url
    video.load()
  })
}

export async function validateCleanupVideoFile(
  file: File,
  maxDurationSec = MAX_CLEANUP_VIDEO_DURATION_SEC,
  options?: { allowUnknownDuration?: boolean }
): Promise<VideoValidationResult> {
  if (file.size > MAX_CLEANUP_VIDEO_BYTES) {
    return {
      ok: false,
      reason: 'too_large',
      message: `Video must be under ${Math.round(MAX_CLEANUP_VIDEO_BYTES / (1024 * 1024))} MB`,
    }
  }

  try {
    const durationSec = await loadVideoDuration(file)

    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      if (options?.allowUnknownDuration && isLikelyMobileSafari()) {
        return { ok: true, durationSec: 0, durationUnknown: true }
      }
      return {
        ok: false,
        reason: 'invalid_duration',
        message: 'Could not read video length. Try MP4 or MOV.',
      }
    }

    if (durationSec > maxDurationSec + 0.25) {
      return {
        ok: false,
        reason: 'too_long',
        message: `Video must be ${maxDurationSec} seconds or shorter (yours is ${Math.ceil(durationSec)}s)`,
      }
    }

    return { ok: true, durationSec }
  } catch {
    if (options?.allowUnknownDuration && isLikelyMobileSafari()) {
      return { ok: true, durationSec: 0, durationUnknown: true }
    }

    return {
      ok: false,
      reason: 'metadata_unavailable',
      message:
        'Safari could not read this video. Try a clip from Photos (MP4/MOV), or tap Add anyway if it is under 10 seconds.',
    }
  }
}
