'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import type { Address } from 'viem'
import { isVerifier as checkIsVerifier } from '@/lib/blockchain/contracts'

/**
 * Hook to check if the connected wallet is a verifier
 * 
 * Current: Queries the smart contract for VERIFIER_ROLE (whitelisted addresses)
 * Future: Will also check $cDCU staking status
 */
export function useIsVerifier() {
    const { address, isConnected } = useAccount()
    const [isVerifier, setIsVerifier] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        async function checkVerifierStatus() {
            if (!isConnected || !address) {
                setIsVerifier(false)
                return
            }

            try {
                setIsLoading(true)
                // Query the smart contract to check if address is a verifier
                const result = await checkIsVerifier(address)
                setIsVerifier(result)
            } catch (error) {
                // Silently handle missing contract addresses during development
                const errorMessage = error instanceof Error ? error.message : String(error)
                if (errorMessage.includes('contract address not set')) {
                    // Contract not deployed yet - not a verifier
                    setIsVerifier(false)
                } else {
                    console.error('Error checking verifier status:', error)
                    setIsVerifier(false)
                }
            } finally {
                setIsLoading(false)
            }
        }

        checkVerifierStatus()
    }, [address, isConnected])

    return { isVerifier, isLoading }
}
