import 'server-only'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'

const CELO_MAINNET = 42220

export function getPimlicoChainSlug(): 'celo' | 'celo-sepolia' {
  return REQUIRED_CHAIN_ID === CELO_MAINNET ? 'celo' : 'celo-sepolia'
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
  return `https://api.pimlico.io/v2/${getPimlicoChainSlug()}/rpc?apikey=${apiKey}`
}

export function isPimlicoConfigured(): boolean {
  return getPimlicoApiKey() != null
}
