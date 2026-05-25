'use client'

const DEVICE_LABEL_KEY = 'decleanup-device-label'

/** Human-readable label for the current browser/device (signing session indicator). */
export function getDeviceLabel(): string {
  if (typeof window === 'undefined') return 'Unknown device'

  const saved = localStorage.getItem(DEVICE_LABEL_KEY)
  if (saved) return saved

  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'Apple mobile'
  if (/Android/i.test(ua)) return 'Android'
  if (/Mac OS X/i.test(ua)) return 'Mac'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Linux/i.test(ua)) return 'Linux'
  return 'This browser'
}

export function setDeviceLabel(label: string): void {
  localStorage.setItem(DEVICE_LABEL_KEY, label.trim().slice(0, 48))
}
