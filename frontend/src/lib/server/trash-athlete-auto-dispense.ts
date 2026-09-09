import 'server-only'
import { randomBytes } from 'crypto'
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { CLAIM_CATEGORY, signClaimVaultClaim } from '@/lib/cdcu/claim-signing'
import { REQUIRED_CHAIN_ID, REQUIRED_RPC_URL } from '@/lib/blockchain/chain-constants'
import { markTrashAthleteBonusClaimed } from '@/lib/supabase/trash-athlete-db'
import type { TrashAthleteChallenge } from '@/lib/trash-athlete/types'
import { TRASH_ATHLETE_BONUS_CDCU } from '@/lib/trash-athlete/constants'
import { findWalletMetadata } from '@/lib/wallet/repository'

const CLAIMVAULT_ABI = [
  {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'category', type: 'uint8' },
      { name: 'nonce', type: 'uint256' },
      { name: 'expiry', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const

const MAX_EXPIRY_SECONDS = 7 * 24 * 60 * 60

function normalizePrivateKey(raw: string | undefined): `0x${string}` | undefined {
  if (!raw || typeof raw !== 'string') return undefined
  const trimmed = raw.trim().replace(/^0x/i, '')
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) return undefined
  return `0x${trimmed}` as `0x${string}`
}

function getChain() {
  const isMainnet = REQUIRED_CHAIN_ID === 42220
  return {
    id: REQUIRED_CHAIN_ID,
    name: isMainnet ? 'Celo' : 'Celo Sepolia',
    nativeCurrency: { decimals: 18, name: 'CELO', symbol: 'CELO' },
    rpcUrls: { default: { http: [REQUIRED_RPC_URL] } },
  } as const
}

export type AutoDispenseResult =
  | { ok: true; txHash: Hex; recipient: Address; amountCdcu: string }
  | { ok: false; reason: string }

/**
 * After verifier approval: sign + submit ClaimVault.claim() so the user receives
 * 150 $cDCU without a manual claim UI. Uses CLAIM_VAULT_RELAYER_PRIVATE_KEY for gas
 * when set; otherwise the authorized signer key (must hold CELO).
 */
export async function autoDispenseTrashAthleteBonus(
  challenge: TrashAthleteChallenge
): Promise<AutoDispenseResult> {
  if (challenge.status !== 'APPROVED') {
    return { ok: false, reason: 'Challenge is not approved' }
  }
  if (challenge.bonusCdcuClaimed) {
    return { ok: false, reason: 'Bonus already claimed' }
  }

  const signerKey = normalizePrivateKey(process.env.CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY)
  const relayerKey =
    normalizePrivateKey(process.env.CLAIM_VAULT_RELAYER_PRIVATE_KEY) || signerKey
  const claimVaultAddress = process.env.NEXT_PUBLIC_CLAIMVAULT_ADDRESS as Address | undefined

  if (!signerKey || !relayerKey || !claimVaultAddress) {
    return {
      ok: false,
      reason:
        'ClaimVault auto-dispense not configured (CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY + NEXT_PUBLIC_CLAIMVAULT_ADDRESS)',
    }
  }

  // Prefer signer EOA (MetaMask / gardens); fall back to challenge wallet (usually smart account).
  let recipient = challenge.walletAddress as Address
  if (challenge.userId) {
    try {
      const wallet = await findWalletMetadata(challenge.userId)
      if (wallet?.address) recipient = wallet.address as Address
    } catch {
      /* use challenge.walletAddress */
    }
  }

  const amountCdcu = challenge.bonusCdcuAmount || TRASH_ATHLETE_BONUS_CDCU
  const amountWei = parseEther(amountCdcu)
  const nonce = BigInt(`0x${randomBytes(16).toString('hex')}`)
  const expiry = Math.floor(Date.now() / 1000) + MAX_EXPIRY_SECONDS

  try {
    const signed = await signClaimVaultClaim(
      {
        recipient,
        amount: amountWei,
        category: CLAIM_CATEGORY.CommunityIncentives,
        nonce,
        expiry,
      },
      REQUIRED_CHAIN_ID,
      claimVaultAddress,
      signerKey
    )

    const account = privateKeyToAccount(relayerKey)
    const chain = getChain()
    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(REQUIRED_RPC_URL),
    })
    const publicClient = createPublicClient({
      chain,
      transport: http(REQUIRED_RPC_URL),
    })

    const hash = await walletClient.writeContract({
      address: claimVaultAddress,
      abi: CLAIMVAULT_ABI,
      functionName: 'claim',
      args: [
        signed.recipient,
        signed.amount,
        signed.category,
        signed.nonce,
        BigInt(signed.expiry),
        signed.v,
        signed.r,
        signed.s,
      ],
      chain,
      account,
      gas: 350_000n,
    })

    await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 })
    await markTrashAthleteBonusClaimed({ id: challenge.id, txHash: hash })

    return { ok: true, txHash: hash, recipient, amountCdcu }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[trash-athlete auto-dispense]', challenge.id, msg)
    return { ok: false, reason: msg.slice(0, 400) }
  }
}
