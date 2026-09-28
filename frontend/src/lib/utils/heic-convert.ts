/**
 * Convert HEIC/HEIF (common on iPhone) to JPEG for IPFS and preview.
 * Desktop Chrome often hangs inside heic2any/WASM - prefer native decode, then a timed
 * WASM attempt, then pass the original file through for server-side conversion.
 */

/** ISO BMFF: byte 4-7 `ftyp`, byte 8-11 major brand - HEIC/HEIF family. */
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

const NATIVE_DECODE_MS = 8_000
const HEIC2ANY_MS = 10_000
const HEIC2ANY_MAX_BYTES = 4 * 1024 * 1024

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        window.clearTimeout(timer)
        reject(err)
      }
    )
  })
}

async function readFirstBytes(file: File, n: number): Promise<Uint8Array | null> {
  try {
    const head = file.slice(0, n)
    if (typeof head.arrayBuffer === 'function') {
      return new Uint8Array(await head.arrayBuffer())
    }
    if (typeof FileReader === 'undefined') return null
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        resolve(reader.result instanceof ArrayBuffer ? new Uint8Array(reader.result) : null)
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(head)
    })
  } catch {
    return null
  }
}

export async function looksLikeHeic(file: File): Promise<boolean> {
  const lower = file.name.toLowerCase()
  if (
    lower.endsWith('.heic') ||
    lower.endsWith('.heif') ||
    file.type === 'image/heic' ||
    file.type === 'image/heif'
  ) {
    return true
  }

  const bytes = await readFirstBytes(file, 12)
  if (!bytes || bytes.byteLength < 12) return false
  const ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7])
  const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
  return ftyp === 'ftyp' && HEIC_HEIF_BRANDS.includes(brand)
}

function jpegFileFromBlob(blob: Blob, originalName: string): File {
  const base = originalName.replace(/\.(heic|heif|jpe?g|png)$/i, '') || 'photo'
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' })
}

async function tryNativeToJpeg(file: File): Promise<File | null> {
  if (typeof createImageBitmap !== 'function') return null
  try {
    const bitmap = await withTimeout(createImageBitmap(file), NATIVE_DECODE_MS, 'Native HEIC decode')
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, bitmap.width)
    canvas.height = Math.max(1, bitmap.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return null
    }
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    const blob = await withTimeout(
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92)),
      5_000,
      'HEIC canvas encode'
    )
    if (!blob) return null
    return jpegFileFromBlob(blob, file.name)
  } catch {
    return null
  }
}

async function tryHeic2anyToJpeg(file: File): Promise<File | null> {
  try {
    const heic2any = (await import('heic2any')).default
    const result = await withTimeout(
      heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.92,
      }),
      HEIC2ANY_MS,
      'heic2any JPEG'
    )
    const blob = Array.isArray(result) ? result[0] : result
    return jpegFileFromBlob(blob, file.name)
  } catch (jpegErr) {
    console.warn('[HEIC] heic2any JPEG failed:', jpegErr)
    try {
      const heic2any = (await import('heic2any')).default
      const result = await withTimeout(
        heic2any({
          blob: file,
          toType: 'image/png',
        }),
        HEIC2ANY_MS,
        'heic2any PNG'
      )
      const blob = Array.isArray(result) ? result[0] : result
      const jpeg = await pngBlobToJpeg(blob, file.name)
      return jpeg ?? jpegFileFromBlob(blob, file.name)
    } catch (pngErr) {
      console.warn('[HEIC] heic2any PNG failed:', pngErr)
      return null
    }
  }
}

async function pngBlobToJpeg(blob: Blob, originalName: string): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return null
    }
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    if (!jpeg) return null
    return jpegFileFromBlob(jpeg, originalName)
  } catch {
    return null
  }
}

export async function convertHeicOnServer(file: File): Promise<File | null> {
  try {
    const body = new FormData()
    body.append('file', file)
    const res = await fetch('/api/photos/convert-heic', { method: 'POST', body })
    if (!res.ok) return null
    const blob = await res.blob()
    if (blob.size < 32) return null
    return jpegFileFromBlob(blob, file.name)
  } catch (err) {
    console.warn('[HEIC] server convert failed:', err)
    return null
  }
}

export async function normalizeImageFileForUpload(file: File): Promise<File> {
  if (!(await looksLikeHeic(file))) return file

  const native = await tryNativeToJpeg(file)
  if (native) return native

  const fromServer = await convertHeicOnServer(file)
  if (fromServer && !(await looksLikeHeic(fromServer))) return fromServer

  if (file.size <= HEIC2ANY_MAX_BYTES) {
    const converted = await tryHeic2anyToJpeg(file)
    if (converted) return converted
  }

  throw new Error('Could not convert this iPhone photo. Pick it again, or try a JPEG from Photos.')
}
