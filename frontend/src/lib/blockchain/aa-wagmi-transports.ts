import { http, type Transport } from 'wagmi'
import { aaWagmiChains } from '@/lib/blockchain/aa-wagmi-chains'

/** One HTTP transport per picker chain so readContract never hits a missing chainId. */
export function aaWagmiHttpTransports(): Record<number, Transport> {
  return Object.fromEntries(
    aaWagmiChains.map((chain) => {
      const url = chain.rpcUrls.default.http[0]
      return [chain.id, http(url)]
    })
  )
}
