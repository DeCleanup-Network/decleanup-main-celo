/**
 * Convert HEIC/HEIF (common on iPhone) to JPEG for IPFS and preview.
 * Uses dynamic import so the library is not loaded until needed.
 */
/** ISO BMFF: byte 4–7 `ftyp`, byte 8–11 major brand — HEIC/HEIF family. */
const HEIC_HEIF_BRANDS = [
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
]

export async function normalizeImageFileForUpload(file: File): Promise<File> {
  const lower = file.name.toLowerCase()
  let isHeic =
    lower.endsWith('.heic') ||
    lower.endsWith('.heif') ||
    file.type === 'image/heic' ||
    file.type === 'image/heif'

  if (!isHeic) {
    const buf = await file.slice(0, 12).arrayBuffer()
    if (buf.byteLength >= 12) {
      const bytes = new Uint8Array(buf)
      const ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7])
      const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
      if (ftyp === 'ftyp' && HEIC_HEIF_BRANDS.includes(brand)) {
        isHeic = true
      }
    }
  }

  if (!isHeic) return file

  const heic2any = (await import('heic2any')).default
  const base = file.name.replace(/\.(heic|heif)$/i, '') || 'photo'

  const toFile = (blob: Blob, ext: 'jpg' | 'png', type: string) =>
    new File([blob], `${base}.${ext}`, { type })

  try {
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92,
    })
    const blob = Array.isArray(result) ? result[0] : result
    return toFile(blob, 'jpg', 'image/jpeg')
  } catch {
    // Some iPhone encodings (e.g. HEIF variants) fail libheif — try PNG output.
    const result = await heic2any({
      blob: file,
      toType: 'image/png',
    })
    const blob = Array.isArray(result) ? result[0] : result
    return toFile(blob, 'png', 'image/png')
  }
}
