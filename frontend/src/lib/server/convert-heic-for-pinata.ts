import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'

const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']

/**
 * When sharp’s bundled libheif cannot decode HEVC-in-HEIC (common on iPhone), try the system
 * `heif-convert` from `libheif-bin` + `libheif-plugin-libde265` on Debian/Ubuntu.
 * Set HEIF_CONVERT_BIN to override the executable name/path.
 */
function tryHeifConvertCliToJpeg(input: Buffer, outName: string): File | null {
  const bin = (process.env.HEIF_CONVERT_BIN || 'heif-convert').trim() || 'heif-convert'
  const dir = mkdtempSync(join(tmpdir(), 'decleanup-heif-'))
  const inPath = join(dir, 'in.heic')
  const outPath = join(dir, 'out.jpg')
  try {
    writeFileSync(inPath, input)
    execFileSync(bin, [inPath, outPath], { stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 })
    const jpegBuf = readFileSync(outPath)
    return new File([new Uint8Array(jpegBuf)], outName, { type: 'image/jpeg' })
  } catch {
    return null
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
}

/**
 * HEIC/HEIF → JPEG before Pinata (libvips via sharp; broader decoder support than browser heic2any).
 * Uses MIME/extension hints plus magic-byte sniffing (ftyp + HEIF brand) when hints are missing.
 */
export async function convertHeicToJpegIfNeeded(file: File): Promise<File> {
  const lower = file.name.toLowerCase()
  const extHeic = lower.endsWith('.heic') || lower.endsWith('.heif')
  const type = (file.type || '').trim()
  let needsConvert = type === 'image/heic' || type === 'image/heif' || type === '' || extHeic

  const input = Buffer.from(await file.arrayBuffer())
  if (type === '' || extHeic) {
    const ftyp = input.length >= 8 ? input.slice(4, 8).toString('ascii') : ''
    const brand = input.length >= 12 ? input.slice(8, 12).toString('ascii') : ''
    needsConvert = needsConvert && ftyp === 'ftyp' && HEIC_BRANDS.includes(brand)
  }

  if (!needsConvert) return file

  const withoutHeif = file.name.replace(/\.(heic|heif)$/i, '')
  const stem = withoutHeif.replace(/\.[^/.]+$/, '') || withoutHeif || 'photo'
  const outName = `${stem}.jpg`

  try {
    const jpegBuf = await sharp(input).jpeg({ quality: 92 }).toBuffer()
    return new File([new Uint8Array(jpegBuf)], outName, { type: 'image/jpeg' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('sharp HEIC→JPEG failed, trying heif-convert if available:', msg)
    const fallback = tryHeifConvertCliToJpeg(input, outName)
    if (fallback) return fallback
    throw err
  }
}
