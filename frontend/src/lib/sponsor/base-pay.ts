import { isAddress } from 'viem'

/** Official Base mainnet USDC (6 decimals). Base Pay settles this internally. */
export const USDC_BASE_MAINNET_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const

export const BASESCAN_TX = 'https://basescan.org/tx'

export function isBasePayTestnet(): boolean {
  return process.env.NEXT_PUBLIC_BASE_PAY_TESTNET === 'true'
}

export function formatUsdAmount(raw: string): string | null {
  const cleaned = raw.replace(/[^0-9.]/g, '')
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n <= 0) return null
  return n.toFixed(2)
}

export function normalizeBasePaymentTxHash(value: string | null | undefined): `0x${string}` | null {
  if (!value) return null
  const trimmed = value.trim()
  if (/^0x[a-fA-F0-9]{64}$/.test(trimmed)) return trimmed as `0x${string}`
  return null
}

export function pickBasePayPayer(params: {
  statusFrom?: string | null
  connectedAddress?: string | null
}): string | null {
  if (params.statusFrom && isAddress(params.statusFrom)) return params.statusFrom
  if (params.connectedAddress && isAddress(params.connectedAddress)) return params.connectedAddress
  return null
}
