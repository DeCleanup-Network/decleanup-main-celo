import 'server-only'
import { getActivePimlicoSlug, getPimlicoBundlerUrl } from '@/lib/blockchain/aa-chain'

/** @deprecated Use getActivePimlicoSlug — kept for existing imports. */
export function getPimlicoChainSlug(): string {
  return getActivePimlicoSlug()
}

export function getPimlicoApiKey(): string | null {
  return (
    process.env.PIMLICO_API_KEY?.trim() ??
    process.env.NEXT_PUBLIC_PIMLICO_API_KEY?.trim() ??
    null
  )
}

export function getPimlicoRpcUrl(): string {
  const apiKey = getPimlicoApiKey()
  if (!apiKey) {
    throw new Error('PIMLICO_API_KEY or NEXT_PUBLIC_PIMLICO_API_KEY is not set.')
  }
  return getPimlicoBundlerUrl(apiKey)
}

export function isPimlicoConfigured(): boolean {
  return getPimlicoApiKey() != null
}
