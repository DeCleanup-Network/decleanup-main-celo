'use client'

import { useEffect, useState } from 'react'
import { useEnsName } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import type { Address } from 'viem'

/**
 * Hook to resolve ENS name for an Ethereum address
 * Falls back to null if no ENS name is found
 * Silently handles CORS/network errors
 */
export function useENSName(address: Address | undefined) {
    const [ensName, setEnsName] = useState<string | null>(null)

    // Use wagmi's useEnsName hook to resolve ENS
    // Disable query on HTTP origins to avoid CORS errors with euc.li
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
    const { data, isError, isLoading } = useEnsName({
        address,
        chainId: mainnet.id,
        query: {
            enabled: isHttps && !!address, // Only enable on HTTPS to avoid CORS errors
            retry: false, // Don't retry on error
            refetchOnWindowFocus: false, // Don't refetch on window focus
            staleTime: Infinity, // Cache forever to avoid repeated requests
        },
    })

    useEffect(() => {
        if (data) {
            setEnsName(data)
        } else if (isError || (!isLoading && (!isHttps || !address))) {
            // Silently fail on HTTP, errors, or no address
            setEnsName(null)
        }
    }, [data, isError, isLoading, isHttps, address])

    return { ensName, isLoading: isLoading && isHttps && !!address }
}
