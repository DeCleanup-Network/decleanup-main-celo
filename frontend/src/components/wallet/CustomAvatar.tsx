'use client'

import { AvatarComponent } from '@rainbow-me/rainbowkit'
import { useEffect, useState } from 'react'

/**
 * Custom avatar component that displays ENS images or generates a colorful fallback
 * based on the wallet address
 */
export const CustomAvatar: AvatarComponent = ({ address, ensImage, size }) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(ensImage || null)
  const [imageError, setImageError] = useState(false)

  // Generate a colorful gradient avatar based on address if no ENS image
  useEffect(() => {
    // Reset error state when ensImage changes
    if (ensImage && !imageError) {
      setImageError(false)
      setAvatarUrl(ensImage)
      return
    }

    if (!address) {
      setAvatarUrl(null)
      return
    }

    // Generate fallback avatar if no ENS image or if ENS image failed
    const hash = address.slice(2, 10) // Use first 8 hex chars
    const hue = parseInt(hash, 16) % 360
    const saturation = 60 + (parseInt(hash.slice(0, 2), 16) % 20) // 60-80%
    const lightness = 45 + (parseInt(hash.slice(2, 4), 16) % 15) // 45-60%

    // Create SVG gradient avatar
    const svg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad-${hash}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:hsl(${hue}, ${saturation}%, ${lightness}%);stop-opacity:1" />
            <stop offset="100%" style="stop-color:hsl(${(hue + 60) % 360}, ${saturation}%, ${lightness + 10}%);stop-opacity:1" />
          </linearGradient>
        </defs>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="url(#grad-${hash})" />
        <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-size="${size * 0.4}" fill="white" font-weight="bold" font-family="system-ui, sans-serif">
          ${address.slice(2, 4).toUpperCase()}
        </text>
      </svg>
    `
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    setAvatarUrl(url)

    return () => {
      if (url && !ensImage) {
        URL.revokeObjectURL(url)
      }
    }
  }, [address, ensImage, size, imageError])

  if (!avatarUrl) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: '#58B12F',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'black',
          fontSize: size * 0.4,
          fontWeight: 'bold',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        ?
      </div>
    )
  }

  // If we have an ENS image URL, try to load it with error handling
  if (avatarUrl && ensImage && !imageError) {
    return (
      <img
        src={avatarUrl}
        alt={address || 'Avatar'}
        width={size}
        height={size}
        style={{
          borderRadius: '50%',
          objectFit: 'cover',
        }}
        onError={() => {
          // Silently fall back to generated avatar if ENS image fails to load
          setImageError(true)
        }}
      />
    )
  }

  // Fallback: generated gradient avatar or placeholder
  if (!avatarUrl || imageError) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: '#58B12F',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'black',
          fontSize: size * 0.4,
          fontWeight: 'bold',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {address ? address.slice(2, 4).toUpperCase() : '?'}
      </div>
    )
  }

  return (
    <img
      src={avatarUrl}
      alt={address || 'Avatar'}
      width={size}
      height={size}
      style={{
        borderRadius: '50%',
        objectFit: 'cover',
      }}
      onError={() => {
        setImageError(true)
      }}
    />
  )
}

