export const MAX_CLEANUP_VIDEO_DURATION_SEC = 10
export const MAX_CLEANUP_VIDEO_BYTES = 20 * 1024 * 1024

export type VideoValidationResult =
  | { ok: true; durationSec: number; durationUnknown?: boolean }
  | {
      ok: false
      message: string
      reason?: 'too_large' | 'too_long' | 'metadata_unavailable' | 'invalid_duration'
    }

/** Ensure upload sees a real video MIME when the OS left it blank (common on iOS). */
export function normalizeCleanupVideoFile(file: File): File {
  const t = (file.type || '').toLowerCase().trim()
  if (t === 'video/mp4' || t === 'video/quicktime' || t === 'video/webm' || t === 'video/x-m4v') {
    return file
  }
  const name = (file.name || '').toLowerCase()
  let mime = ''
  if (name.endsWith('.mov')) mime = 'video/quicktime'
  else if (name.endsWith('.webm')) mime = 'video/webm'
  else if (name.endsWith('.m4v')) mime = 'video/x-m4v'
  else if (name.endsWith('.mp4')) mime = 'video/mp4'
  else if (t.startsWith('video/')) mime = t
  if (!mime || mime === t) return file
  const ext = mime === 'video/quicktime' ? 'mov' : mime === 'video/webm' ? 'webm' : 'mp4'
  return new File([file], file.name || `cleanup-video.${ext}`, {
    type: mime,
    lastModified: file.lastModified,
  })
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
      message: `Video must be under ${Math.round(MAX_CLEANUP_VIDEO_BYTES / (1024 * 1024))} MB (yours is ${(file.size / (1024 * 1024)).toFixed(1)} MB). Trim the clip or lower quality in Photos.`,
    }
  }

  const allowUnknown = options?.allowUnknownDuration !== false

  try {
    const durationSec = await loadVideoDuration(file)

    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      if (allowUnknown && isLikelyMobileSafari()) {
        return { ok: true, durationSec: 0, durationUnknown: true }
      }
      return {
        ok: false,
        reason: 'invalid_duration',
        message: 'Could not read video length. Try MP4 or MOV, or a shorter clip from Photos.',
      }
    }

    if (durationSec > maxDurationSec + 0.5) {
      return {
        ok: false,
        reason: 'too_long',
        message: `Video must be ${maxDurationSec} seconds or shorter (yours is ${Math.ceil(durationSec)}s)`,
      }
    }

    return { ok: true, durationSec }
  } catch {
    if (allowUnknown && isLikelyMobileSafari()) {
      return { ok: true, durationSec: 0, durationUnknown: true }
    }

    return {
      ok: false,
      reason: 'metadata_unavailable',
      message:
        'Could not read this video. Try a clip from Photos (MP4/MOV under 10 seconds), or tap Add anyway if you are sure it is short enough.',
    }
  }
}
