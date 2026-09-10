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

// Maskable-friendly 512 with safe-zone padding (Android adaptive)
const pad = 96
const inner = 512 - pad * 2
const paddedIcon = await sharp(iconPath)
  .resize(inner, inner, { fit: 'contain', background: BG })
  .png()
  .toBuffer()

await sharp({
  create: { width: 512, height: 512, channels: 4, background: BG },
})
  .composite([{ input: paddedIcon, left: pad, top: pad }])
  .png()
  .toFile(join(root, 'public', 'icon-512-maskable.png'))

console.log('wrote icon-512-maskable.png')
console.log('done')
