'use client'

import { useEffect, useState } from 'react'

export function CeloUserGuide() {
  const [src, setSrc] = useState('/guide-celo.html')

  useEffect(() => {
    if (window.location.hash) {
      setSrc(`/guide-celo.html${window.location.hash}`)
    }
  }, [])

  return (
    <iframe
      src={src}
      title="User Guide - Celo"
      className="block w-full border-0 bg-background"
      style={{
        height: 'calc(100dvh - 5.5rem - env(safe-area-inset-top, 0px))',
        minHeight: '32rem',
      }}
    />
  )
}
