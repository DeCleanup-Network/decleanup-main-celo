/**
 * Hypercert Image Generator
 * Creates logo, banner, and main image for Hypercerts from cleanup photos and impact data
 */

import { uploadToIPFS } from '@/lib/blockchain/ipfs'
import { getIPFSUrl } from '@/lib/blockchain/ipfs'

type CleanupData = {
  cleanupIds: bigint[]
  beforePhotos: string[]
  afterPhotos: string[]
  totalWeight: number
  totalArea: number
  totalHours: number
}

/**
 * Generate a collage image from multiple cleanup photos
 * Creates a grid layout with before/after photos
 */
export async function generateHypercertCollage(
  beforePhotos: string[],
  afterPhotos: string[],
  width: number = 1200,
  height: number = 800
): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Could not get canvas context')
  }

  // Background
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#1a1a1a')
  gradient.addColorStop(1, '#0a3d2e')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  const photos = [...beforePhotos, ...afterPhotos].slice(0, 6)
  const cols = 3
  const rows = Math.ceil(photos.length / cols)
  const photoWidth = width / cols
  const photoHeight = height / rows

  const loadPromises = photos.map(async (hash, index) => {
    return new Promise<void>((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        const col = index % cols
        const row = Math.floor(index / cols)
        const x = col * photoWidth
        const y = row * photoHeight

        ctx.save()
        ctx.beginPath()
        const radius = 10
        const left = x + 10
        const top = y + 10
        const right = left + photoWidth - 20
        const bottom = top + photoHeight - 20

        ctx.moveTo(left + radius, top)
        ctx.lineTo(right - radius, top)
        ctx.quadraticCurveTo(right, top, right, top + radius)
        ctx.lineTo(right, bottom - radius)
        ctx.quadraticCurveTo(right, bottom, right - radius, bottom)
        ctx.lineTo(left + radius, bottom)
        ctx.quadraticCurveTo(left, bottom, left, bottom - radius)
        ctx.lineTo(left, top + radius)
        ctx.quadraticCurveTo(left, top, left + radius, top)
        ctx.closePath()
        ctx.clip()

        ctx.drawImage(img, left, top, photoWidth - 20, photoHeight - 20)
        ctx.restore()
        resolve()
      }

      img.onerror = () => resolve()

      const gateways = [
        `https://ipfs.io/ipfs/${hash}`,
        `https://gateway.pinata.cloud/ipfs/${hash}`,
        `https://dweb.link/ipfs/${hash}`,
        `https://cloudflare-ipfs.com/ipfs/${hash}`,
      ]

      let i = 0
      const tryNext = () => {
        if (i < gateways.length) {
          img.src = gateways[i++]
        } else {
          resolve()
        }
      }

      img.onerror = tryNext
      tryNext()
    })
  })

  await Promise.all(loadPromises)

  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Failed to create image blob'))
        return
      }

      try {
        const file = new File(
          [blob],
          `hypercert-collage-${Date.now()}.png`,
          { type: 'image/png' }
        )

        const result = await uploadToIPFS(file)
        resolve(result.hash)
      } catch (error) {
        reject(error)
      }
    }, 'image/png')
  })
}

/**
 * Generate a banner image with stats overlay
 */
export async function generateHypercertBanner(
  cleanupData: CleanupData,
  hypercertNumber: number,
  width: number = 1200,
  height: number = 400
): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Could not get canvas context')
  }

  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#0a3d2e')
  gradient.addColorStop(1, '#1a5f3f')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 48px Arial'
  ctx.textAlign = 'center'
  ctx.fillText(`DeCleanup Impact Certificate #${hypercertNumber}`, width / 2, 80)

  const stats = [
    { label: 'Cleanups', value: cleanupData.cleanupIds.length.toString() },
    { label: 'Weight Removed', value: `${cleanupData.totalWeight.toFixed(1)} kg` },
    { label: 'Area Cleaned', value: `${cleanupData.totalArea.toFixed(1)} m²` },
    { label: 'Hours Spent', value: `${cleanupData.totalHours.toFixed(1)} h` },
  ]

  const statWidth = width / stats.length
  ctx.font = 'bold 36px Arial'

  stats.forEach((stat, index) => {
    const x = (index + 0.5) * statWidth
    ctx.fillStyle = '#58b12f'
    ctx.fillText(stat.value, x, 200)
    ctx.fillStyle = '#ffffff'
    ctx.font = '24px Arial'
    ctx.fillText(stat.label, x, 240)
    ctx.font = 'bold 36px Arial'
  })

  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Failed to create banner image'))
        return
      }

      try {
        const file = new File(
          [blob],
          `hypercert-banner-${hypercertNumber}.png`,
          { type: 'image/png' }
        )

        const result = await uploadToIPFS(file)
        resolve(result.hash)
      } catch (error) {
        reject(error)
      }
    }, 'image/png')
  })
}

/**
 * Generate a square logo (400x400)
 */
export async function generateHypercertLogo(
  hypercertNumber: number
): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = 400
  canvas.height = 400
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Could not get canvas context')
  }

  const gradient = ctx.createLinearGradient(0, 0, 400, 400)
  gradient.addColorStop(0, '#0a3d2e')
  gradient.addColorStop(1, '#1a5f3f')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 400, 400)

  ctx.fillStyle = '#58b12f'
  ctx.beginPath()
  ctx.ellipse(200, 180, 80, 100, -0.3, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#fbbf24'
  ctx.beginPath()
  ctx.arc(280, 120, 40, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#000'
  ctx.font = 'bold 32px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`#${hypercertNumber}`, 280, 120)

  ctx.fillStyle = '#fff'
  ctx.font = 'bold 28px Arial'
  ctx.fillText('DeCleanup Network', 200, 320)

  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Failed to create logo image'))
        return
      }

      try {
        const file = new File(
          [blob],
          `hypercert-logo-${hypercertNumber}.png`,
          { type: 'image/png' }
        )

        const result = await uploadToIPFS(file)
        resolve(result.hash)
      } catch (error) {
        reject(error)
      }
    }, 'image/png')
  })
}
