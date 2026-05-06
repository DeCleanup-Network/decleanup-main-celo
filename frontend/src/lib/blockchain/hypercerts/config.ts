/**
 * Hypercert minter (UUPS) per chain. Override with NEXT_PUBLIC_HYPERCERTS_MINTER_UUPS_ADDRESS
 * if Hypercerts rotates deployments or you use a fork.
 *
 * Official deployments: https://www.npmjs.com/package/@hypercerts-org/contracts (see package chain artifacts)
 * or Hypercerts docs. Confirm mainnet address before production launch.
 */

const CELO_SEPOLIA_CHAIN_ID = 11142220
const CELO_MAINNET_CHAIN_ID = 42220

/** Celo Sepolia — matches prior app default. */
const CELO_SEPOLIA_HYPERCERT_MINTER = '0x8610fe3190E21bf090c9F463b162A76478A88F5F' as const

/**
 * Celo mainnet HypercertMinter UUPS (public Hypercerts deployment).
 * Re-verify on Hypercerts release artifacts before mainnet launch.
 */
const CELO_MAINNET_HYPERCERT_MINTER = '0x16bA53B74c234C870c61EFC04cD418B8f2865959' as const

const resolvedAppChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || CELO_SEPOLIA_CHAIN_ID)

function resolveHypercertChainId(): number {
  if (resolvedAppChainId === CELO_MAINNET_CHAIN_ID || resolvedAppChainId === CELO_SEPOLIA_CHAIN_ID) {
    return resolvedAppChainId
  }
  return CELO_SEPOLIA_CHAIN_ID
}

function resolveMinterAddress(chainId: number): `0x${string}` {
  const override = process.env.NEXT_PUBLIC_HYPERCERTS_MINTER_UUPS_ADDRESS?.trim()
  if (override && /^0x[a-fA-F0-9]{40}$/.test(override)) {
    return override as `0x${string}`
  }
  if (chainId === CELO_MAINNET_CHAIN_ID) {
    return CELO_MAINNET_HYPERCERT_MINTER
  }
  return CELO_SEPOLIA_HYPERCERT_MINTER
}

const hypercertChainId = resolveHypercertChainId()

export const HYPERCERTS_CONFIG = {
  aggregationModel: 'PER_USER' as const,

  thresholds: {
    production: {
      minCleanups: 10,
      minReports: 1,
    },
    testing: {
      minCleanups: 1,
      minReports: 1,
    },
  },

  metadata: {
    version: 'v1',
    allowNarrative: true,
  },

  contract: {
    address: resolveMinterAddress(hypercertChainId),
    chainId: hypercertChainId,
  },

  network: {
    name: hypercertChainId === CELO_MAINNET_CHAIN_ID ? 'celo' : 'celo-sepolia',
    rpcUrl:
      hypercertChainId === CELO_MAINNET_CHAIN_ID
        ? process.env.NEXT_PUBLIC_RPC_URL || 'https://forno.celo.org'
        : process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://celo-sepolia.drpc.org',
  },
}
