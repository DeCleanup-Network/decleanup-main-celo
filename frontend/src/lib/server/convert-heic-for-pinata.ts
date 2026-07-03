import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'

const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']

function isHeifBuffer(input: Buffer): boolean {
  if (input.length < 12) return false
  const ftyp = input.slice(4, 8).toString('ascii')
  const brand = input.slice(8, 12).toString('ascii')
  return ftyp === 'ftyp' && HEIC_BRANDS.includes(brand)
}

function getHeifConvertBin(): string {
  return (process.env.HEIF_CONVERT_BIN || '/usr/bin/heif-convert').trim() || '/usr/bin/heif-convert'
}

function getHeicPythonBin(): string {
  return (
    process.env.ML_HEIC_PYTHON ||
    process.env.HEIC_PYTHON ||
    '/var/www/decleanup/gpu-inference-service/.venv/bin/python'
  ).trim()
}

/**
 * When sharp’s bundled libheif cannot decode HEVC-in-HEIC (common on iPhone), try the system
 * `heif-convert` from `libheif-examples` + `libheif-plugin-libde265` on Debian/Ubuntu.
 * Set HEIF_CONVERT_BIN to override the executable path.
 */
function tryHeifConvertCliToJpegBuffer(input: Buffer): Buffer | null {
  const bin = getHeifConvertBin()
  const dir = mkdtempSync(join(tmpdir(), 'decleanup-heif-'))
  const inPath = join(dir, 'in.heic')
  const outPath = join(dir, 'out.jpg')
  try {
    writeFileSync(inPath, input)
    execFileSync(bin, [inPath, outPath], { stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 })
    return readFileSync(outPath)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[HEIC] heif-convert failed:', msg.slice(0, 300))
    return null
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
}

/** GPU venv pi_heif — works on VPS when system libheif is too old for iPhone HEIC. */
function tryPythonPiHeifToJpegBuffer(input: Buffer): Buffer | null {
  const python = getHeicPythonBin()
  const dir = mkdtempSync(join(tmpdir(), 'decleanup-heif-py-'))
  const inPath = join(dir, 'in.heic')
  const outPath = join(dir, 'out.jpg')
  const scriptPath = join(dir, 'convert.py')
  try {
    writeFileSync(inPath, input)
    writeFileSync(
      scriptPath,
      `from pi_heif import register_heif_opener
from PIL import Image
register_heif_opener()
Image.open(${JSON.stringify(inPath)}).convert("RGB").save(${JSON.stringify(outPath)}, "JPEG", quality=90)
`
    )
    execFileSync(python, [scriptPath], { stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 })
    return readFileSync(outPath)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[HEIC] python pi_heif failed:', msg.slice(0, 300))
    return null
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
}

function convertHeifBufferToJpeg(input: Buffer): Buffer {
  const heifCli = tryHeifConvertCliToJpegBuffer(input)
  if (heifCli) {
    console.log('[HEIC] converted via heif-convert')
    return heifCli
  }
  const python = tryPythonPiHeifToJpegBuffer(input)
  if (python) {
    console.log('[HEIC] converted via python pi_heif')
    return python
  }
  throw new Error(
    'HEIC/HEIF decode failed (heif-convert and python pi_heif). Install libheif-examples + libheif-plugin-libde265 on the VPS, or set ML_HEIC_PYTHON.'
  )
}

function tryHeifConvertCliToJpeg(input: Buffer, outName: string): File | null {
  const jpegBuf = tryHeifConvertCliToJpegBuffer(input)
  if (!jpegBuf) return null
  return new File([new Uint8Array(jpegBuf)], outName, { type: 'image/jpeg' })
}

/**
 * Buffer → JPEG for server-side pipelines (ML verify, rescore).
 * HEIF/HEIC: skip sharp (bundled libheif lacks system plugins) → heif-convert → python pi_heif.
 */
export async function normalizeImageBufferToJpeg(input: Buffer): Promise<Buffer> {
  if (isHeifBuffer(input)) {
    return convertHeifBufferToJpeg(input)
  }
  try {
    return await sharp(input).rotate().jpeg({ quality: 90 }).toBuffer()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[HEIC] sharp→JPEG failed, trying CLI/python:', msg.slice(0, 200))
    if (isHeifBuffer(input)) {
      return convertHeifBufferToJpeg(input)
    }
    const heifCli = tryHeifConvertCliToJpegBuffer(input)
    if (heifCli) return heifCli
    const python = tryPythonPiHeifToJpegBuffer(input)
    if (python) return python
    throw err
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

  if (isHeifBuffer(input)) {
    const jpegBuf = convertHeifBufferToJpeg(input)
    return new File([new Uint8Array(jpegBuf)], outName, { type: 'image/jpeg' })
  }

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
