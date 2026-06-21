export const MAX_CLEANUP_VIDEO_DURATION_SEC = 10
export const MAX_CLEANUP_VIDEO_BYTES = 20 * 1024 * 1024

export async function validateCleanupVideoFile(
  file: File,
  maxDurationSec = MAX_CLEANUP_VIDEO_DURATION_SEC
): Promise<{ ok: true; durationSec: number } | { ok: false; message: string }> {
  if (file.size > MAX_CLEANUP_VIDEO_BYTES) {
    return {
      ok: false,
      message: `Video must be under ${Math.round(MAX_CLEANUP_VIDEO_BYTES / (1024 * 1024))} MB`,
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const durationSec = await new Promise<number>((resolve, reject) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        resolve(video.duration)
      }
      video.onerror = () => reject(new Error('Could not read video metadata'))
      video.src = url
    })

    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      return { ok: false, message: 'Could not read video length. Try MP4 or MOV.' }
    }
    if (durationSec > maxDurationSec + 0.25) {
      return {
        ok: false,
        message: `Video must be ${maxDurationSec} seconds or shorter (yours is ${Math.ceil(durationSec)}s)`,
      }
    }
    return { ok: true, durationSec }
  } catch {
    return { ok: false, message: 'Could not read video. Try MP4 or MOV from your camera roll.' }
  } finally {
    URL.revokeObjectURL(url)
  }
}
