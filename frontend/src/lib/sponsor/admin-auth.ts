import 'server-only'
import { isAddress } from 'viem'

/** Comma-separated EOAs that may publish/approve events. */
export function getSponsorAdminWallets(): string[] {
  const raw = process.env.SPONSOR_ADMIN_WALLETS || process.env.NEXT_PUBLIC_SPONSOR_ADMIN_WALLETS || ''
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => isAddress(s))
}

export function isSponsorAdminWallet(address: string | null | undefined): boolean {
  if (!address || !isAddress(address)) return false
  const list = getSponsorAdminWallets()
  if (list.length === 0) return false
  return list.includes(address.toLowerCase())
}

/** Optional shared secret for admin API (header x-sponsor-admin-secret). */
export function isValidSponsorAdminSecret(secret: string | null | undefined): boolean {
  const expected = process.env.SPONSOR_ADMIN_SECRET?.trim()
  if (!expected) return false
  return Boolean(secret && secret === expected)
}

export function assertCanManageSponsorEvents(params: {
  walletAddress?: string | null
  adminSecret?: string | null
}): void {
  const walletOk = isSponsorAdminWallet(params.walletAddress)
  const secretOk = isValidSponsorAdminSecret(params.adminSecret)
  if (!walletOk && !secretOk) {
    throw new Error('Not authorized to manage sponsorship events')
  }
}
