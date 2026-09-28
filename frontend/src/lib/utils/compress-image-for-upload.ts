/** Resize large photos before upload (helps iPhone Safari on slow networks). */
const MAX_DIMENSION = 2048
const COMPRESS_IF_LARGER_THAN_BYTES = 2.5 * 1024 * 1024
const JPEG_QUALITY = 0.85
const READY_MAX_BYTES = 10 * 1024 * 1024

function isHeicType(file: File): boolean {
  const t = (file.type || '').toLowerCase()
  const name = (file.name || '').toLowerCase()
  return t.includes('heic') || t.includes('heif') || name.endsWith('.heic') || name.endsWith('.heif')
}

async function encodeJpeg(file: File, maxEdge: number, quality: number): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return null
    }
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', quality)
    })
    if (!blob) return null
    const base = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
  } catch {
    return null
  }
}

export async function compressImageIfLarge(file: File): Promise<File> {
  if (isHeicType(file)) return file
  if (file.type && !file.type.startsWith('image/') && file.type !== 'application/octet-stream') {
    return file
  }
  if (file.size <= COMPRESS_IF_LARGER_THAN_BYTES) return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    if (scale >= 1 && file.size <= COMPRESS_IF_LARGER_THAN_BYTES) {
      bitmap.close()
      return file
    }

    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    })
    if (!blob || blob.size >= file.size) return file

    const base = file.name.replace(/\.[^.]+$/, '') || 'photo'
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
  } catch {
    return file
  }
}

/** Keep shrinking until the file is at or under the upload cap (iPhone originals are often 12-25 MB). */
export async function compressImageToUploadLimit(
  file: File,
  maxBytes = READY_MAX_BYTES
): Promise<File> {
  if (isHeicType(file)) return file
  let current = file.size > COMPRESS_IF_LARGER_THAN_BYTES ? await compressImageIfLarge(file) : file
  if (current.size <= maxBytes) return current

  let quality = 0.78
  let edge = 1920
  for (let i = 0; i < 6; i++) {
    const next = await encodeJpeg(current, edge, quality)
    if (next && next.size < current.size) current = next
    if (current.size <= maxBytes) return current
    quality = Math.max(0.4, quality - 0.1)
    edge = Math.max(1280, Math.round(edge * 0.82))
  }
  return current
}
