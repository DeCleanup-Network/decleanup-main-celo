/** Resize large photos before upload (helps iPhone Safari on slow networks). */
const MAX_DIMENSION = 2048
const COMPRESS_IF_LARGER_THAN_BYTES = 2.5 * 1024 * 1024
const JPEG_QUALITY = 0.85

export async function compressImageIfLarge(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type.includes('heic') || file.type.includes('heif')) {
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
