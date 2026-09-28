import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'

const require = createRequire(import.meta.url)

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
  if (!existsSync(bin)) return null
  const dir = mkdtempSync(join(tmpdir(), 'decleanup-heif-'))
  const inPath = join(dir, 'in.heic')
  const outPath = join(dir, 'out.jpg')
  try {
    writeFileSync(inPath, input)
    execFileSync(bin, [inPath, outPath], { stdio: 'pipe', maxBuffer: 50 * 1024 * 1024, timeout: 20_000 })
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

/** GPU venv pi_heif - works on VPS when system libheif is too old for iPhone HEIC. */
function tryPythonPiHeifToJpegBuffer(input: Buffer): Buffer | null {
  const python = getHeicPythonBin()
  if (!existsSync(python)) return null
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
    execFileSync(python, [scriptPath], { stdio: 'pipe', maxBuffer: 50 * 1024 * 1024, timeout: 20_000 })
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

/** macOS Preview decoder - available on local Next and any Darwin host. */
function trySipsToJpegBuffer(input: Buffer): Buffer | null {
  if (process.platform !== 'darwin') return null
  const bin = '/usr/bin/sips'
  if (!existsSync(bin)) return null
  const dir = mkdtempSync(join(tmpdir(), 'decleanup-sips-'))
  const inPath = join(dir, 'in.heic')
  const outPath = join(dir, 'out.jpg')
  try {
    writeFileSync(inPath, input)
    execFileSync(bin, ['-s', 'format', 'jpeg', inPath, '--out', outPath], {
      stdio: 'pipe',
      maxBuffer: 50 * 1024 * 1024,
      timeout: 20_000,
    })
    return readFileSync(outPath)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[HEIC] sips failed:', msg.slice(0, 300))
    return null
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
}

async function tryHeicConvertNpm(input: Buffer): Promise<Buffer | null> {
  try {
    const loaded = require('heic-convert') as
      | ((opts: { buffer: Buffer; format: string; quality: number }) => Promise<ArrayBuffer>)
      | { default: (opts: { buffer: Buffer; format: string; quality: number }) => Promise<ArrayBuffer> }
    const convert = typeof loaded === 'function' ? loaded : loaded.default
    const out = await convert({
      buffer: input,
      format: 'JPEG',
      quality: 0.9,
    })
    return Buffer.from(out)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[HEIC] heic-convert failed:', msg.slice(0, 300))
    return null
  }
}

async function convertHeifBufferToJpeg(input: Buffer): Promise<Buffer> {
  // Do not try sharp first: bundled libheif often hangs on iPhone HEVC-in-HEIC.
  const sips = trySipsToJpegBuffer(input)
  if (sips) {
    console.log('[HEIC] converted via sips')
    return sips
  }
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
  const wasm = await tryHeicConvertNpm(input)
  if (wasm) {
    console.log('[HEIC] converted via heic-convert')
    return wasm
  }
  throw new Error(
    'HEIC/HEIF decode failed. Install libheif-examples + libheif-plugin-libde265, or set ML_HEIC_PYTHON.'
  )
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
      return await convertHeifBufferToJpeg(input)
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
  const type = (file.type || '').toLowerCase().trim()
  const input = Buffer.from(await file.arrayBuffer())
  const heif = isHeifBuffer(input)
  const labeledHeic = type.includes('heic') || type.includes('heif') || extHeic
  const needsConvert = heif || labeledHeic

  if (!needsConvert) return file

  const withoutHeif = file.name.replace(/\.(heic|heif)$/i, '')
  const stem = withoutHeif.replace(/\.[^/.]+$/, '') || withoutHeif || 'photo'
  const outName = `${stem}.jpg`
  const jpegBuf = await convertHeifBufferToJpeg(input)
  return new File([new Uint8Array(jpegBuf)], outName, { type: 'image/jpeg' })
}
