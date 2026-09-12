/**
 * Generate iOS apple-touch-startup-image PNGs from icon-512 on brand dark background.
 * Run: node scripts/generate-pwa-splash.mjs
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'splash')
const iconPath = join(root, 'public', 'icon-512.png')
const BG = { r: 10, g: 10, b: 10, alpha: 1 } // #0a0a0a

/** Common iPhone / iPad portrait launch sizes (CSS pixels × device scale). */
const SPLASHES = [
  { w: 1290, h: 2796, file: 'iphone-15-pro-max.png' },
  { w: 1179, h: 2556, file: 'iphone-15-pro.png' },
  { w: 1284, h: 2778, file: 'iphone-14-plus.png' },
  { w: 1170, h: 2532, file: 'iphone-14.png' },
  { w: 1242, h: 2688, file: 'iphone-xs-max.png' },
  { w: 1125, h: 2436, file: 'iphone-x.png' },
  { w: 828, h: 1792, file: 'iphone-xr.png' },
  { w: 750, h: 1334, file: 'iphone-8.png' },
  { w: 1242, h: 2208, file: 'iphone-8-plus.png' },
  { w: 1668, h: 2388, file: 'ipad-11.png' },
  { w: 2048, h: 2732, file: 'ipad-12-9.png' },
]

mkdirSync(outDir, { recursive: true })

const iconMeta = await sharp(iconPath).metadata()
const srcW = iconMeta.width || 512

for (const { w, h, file } of SPLASHES) {
  const logoSize = Math.round(Math.min(w, h) * 0.28)
  const logo = await sharp(iconPath)
    .resize(logoSize, logoSize, { fit: 'contain', background: BG })
    .png()
    .toBuffer()

  const left = Math.round((w - logoSize) / 2)
  const top = Math.round((h - logoSize) / 2)

  await sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: logo, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(join(outDir, file))

  console.log('wrote', file, `${w}x${h}`, `(logo ${logoSize} from ${srcW})`)
}

// Maskable: full-bleed brand green + logo in safe zone (avoid black padding on desktop PWAs).
const pad = Math.round(512 * 0.1)
const inner = 512 - pad * 2
const { data: raw, info: rawInfo } = await sharp(iconPath)
  .resize(inner, inner, { fit: 'fill' })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const px = new Uint8ClampedArray(raw)
const iw = rawInfo.width
const ih = rawInfo.height
const visited = new Uint8Array(iw * ih)
const isMatte = (i) => {
  const o = i * 4
  return px[o] < 18 && px[o + 1] < 18 && px[o + 2] < 18
}
const stack = [0, iw - 1, (ih - 1) * iw, (ih - 1) * iw + (iw - 1)]
while (stack.length) {
  const i = stack.pop()
  if (i < 0 || i >= iw * ih || visited[i]) continue
  visited[i] = 1
  if (!isMatte(i)) continue
  px[i * 4 + 3] = 0
  const x = i % iw
  const y = (i / iw) | 0
  if (x > 0) stack.push(i - 1)
  if (x < iw - 1) stack.push(i + 1)
  if (y > 0) stack.push(i - iw)
  if (y < ih - 1) stack.push(i + iw)
}
const paddedIcon = await sharp(px, { raw: { width: iw, height: ih, channels: 4 } })
  .png()
  .toBuffer()

await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 4,
    background: { r: 34, g: 120, b: 48, alpha: 1 },
  },
})
  .composite([{ input: paddedIcon, left: pad, top: pad }])
  .png({ compressionLevel: 9 })
  .toFile(join(root, 'public', 'icon-512-maskable.png'))

console.log('wrote icon-512-maskable.png')
console.log('done')
