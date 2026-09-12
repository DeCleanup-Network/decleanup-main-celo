/**
 * Fix PWA icons: transparent corners for "any", full-bleed green for maskable.
 * Run: node scripts/fix-pwa-icons.mjs
 */
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(root, 'public')
const sourcePath = join(publicDir, 'icon-512.png')

/** Flood-fill near-black corner pixels to transparent (removes fake rounded black matte). */
async function withTransparentCorners(inputPath, size) {
  const { data, info } = await sharp(inputPath)
    .resize(size, size, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const w = info.width
  const h = info.height
  const px = new Uint8ClampedArray(data)
  const visited = new Uint8Array(w * h)
  const isMatte = (i) => {
    const o = i * 4
    const r = px[o]
    const g = px[o + 1]
    const b = px[o + 2]
    // Opaque near-black (the unwanted border), not dark greens in the art
    return r < 18 && g < 18 && b < 18
  }

  const stack = [0, w - 1, (h - 1) * w, (h - 1) * w + (w - 1)]
  while (stack.length) {
    const i = stack.pop()
    if (i < 0 || i >= w * h || visited[i]) continue
    visited[i] = 1
    if (!isMatte(i)) continue
    px[i * 4 + 3] = 0
    const x = i % w
    const y = (i / w) | 0
    if (x > 0) stack.push(i - 1)
    if (x < w - 1) stack.push(i + 1)
    if (y > 0) stack.push(i - w)
    if (y < h - 1) stack.push(i + w)
  }

  return sharp(px, { raw: { width: w, height: h, channels: 4 } }).png({ compressionLevel: 9 })
}

async function writeAnyIcon(size, outName) {
  const img = await withTransparentCorners(sourcePath, size)
  const out = join(publicDir, outName)
  await img.toFile(out)
  console.log('wrote', outName, `${size}x${size} (transparent corners)`)
}

async function writeMaskable() {
  // Full-bleed brand green (no black padding). Graphic stays in ~80% safe zone.
  const size = 512
  const pad = Math.round(size * 0.1)
  const inner = size - pad * 2
  const clearIcon = await withTransparentCorners(sourcePath, inner)
  const logoBuf = await clearIcon.png().toBuffer()

  // Sample a mid-edge green from the source for the bleed background
  const bg = { r: 34, g: 120, b: 48, alpha: 1 }

  await sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: logoBuf, left: pad, top: pad }])
    .png({ compressionLevel: 9 })
    .toFile(join(publicDir, 'icon-512-maskable.png'))

  console.log('wrote icon-512-maskable.png (full-bleed green)')
}

await writeAnyIcon(192, 'icon.png')
await writeAnyIcon(512, 'icon-512.png')
await writeAnyIcon(180, 'apple-icon.png')
await writeMaskable()
console.log('done')
