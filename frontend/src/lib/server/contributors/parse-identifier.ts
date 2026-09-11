import 'server-only'
import { isAddress } from 'viem'
import { createPublicClient, http } from 'viem'
import { celo } from 'viem/chains'

export type ContributorKind = 'email' | 'address' | 'ens'

export type ParsedContributor = {
  identifier: string
  normalized: string
  kind: ContributorKind
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Parse contributor field: email | 0x address | name.eth
 */
export function parseContributorIdentifier(raw: string): ParsedContributor | null {
  const identifier = raw.trim()
  if (!identifier) return null

  if (EMAIL_RE.test(identifier)) {
    return {
      identifier,
      normalized: identifier.toLowerCase(),
      kind: 'email',
    }
  }

  if (isAddress(identifier)) {
    return {
      identifier,
      normalized: identifier.toLowerCase(),
      kind: 'address',
    }
  }

  const ens = identifier.toLowerCase()
  if (ens.endsWith('.eth') && ens.length > 4) {
    return {
      identifier,
      normalized: ens,
      kind: 'ens',
    }
  }

  return null
}

export async function resolveEnsToAddress(ensName: string): Promise<string | null> {
  try {
    const client = createPublicClient({
      chain: celo,
      transport: http(process.env.NEXT_PUBLIC_CELO_RPC_URL || 'https://forno.celo.org'),
    })
    // ENS resolution typically uses mainnet; try universal resolver via viem if configured.
    // Fallback: use ethereum mainnet public RPC for ENS.
    const ethClient = createPublicClient({
      chain: {
        id: 1,
        name: 'Ethereum',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: ['https://eth.llamarpc.com'] } },
      },
      transport: http('https://eth.llamarpc.com'),
    })
    void client
    const addr = await ethClient.getEnsAddress({ name: ensName })
    return addr ? addr.toLowerCase() : null
  } catch {
    return null
  }
}
