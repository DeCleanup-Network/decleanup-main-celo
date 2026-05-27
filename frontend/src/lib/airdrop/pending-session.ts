const STORAGE_KEY = 'decleanup_airdrop_pending_address'

export function savePendingAirdropAddress(address: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, address.toLowerCase())
  } catch {
    // ignore quota / private mode
  }
}

export function readPendingAirdropAddress(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function clearPendingAirdropAddress(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function airdropPageUrl(address: string): string {
  return `/airdrop?address=${encodeURIComponent(address)}`
}
