import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { type Address, isAddress, parseEther } from 'viem'
import { auth } from '@/auth'
import { CLAIM_CATEGORY, signClaimVaultClaim } from '@/lib/cdcu/claim-signing'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import {
  findClaimableTrashAthleteBonus,
  getTrashAthleteById,
  markTrashAthleteBonusClaimed,
} from '@/lib/supabase/trash-athlete-db'
import { findWalletMetadata } from '@/lib/wallet/repository'
import { enforceApiRateLimit } from '@/lib/server/rate-limit'
import { apiErrorMessage, logApiError } from '@/lib/server/api-error'
import { TRASH_ATHLETE_BONUS_CDCU } from '@/lib/trash-athlete/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_EXPIRY_SECONDS = 7 * 24 * 60 * 60

function normalizePrivateKey(raw: string | undefined): `0x${string}` | undefined {
  if (!raw || typeof raw !== 'string') return undefined
  const trimmed = raw.trim().replace(/^0x/i, '')
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) return undefined
  return `0x${trimmed}` as `0x${string}`
}

/** Sign a ClaimVault grant for an approved Trash Athlete Challenge (150 $cDCU). */
export async function POST(request: NextRequest) {
  try {
    const privateKey = normalizePrivateKey(process.env.CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY)
    const claimVaultAddress = process.env.NEXT_PUBLIC_CLAIMVAULT_ADDRESS as Address | undefined
    const chainId = REQUIRED_CHAIN_ID
    if (!privateKey || !claimVaultAddress || !isAddress(claimVaultAddress)) {
      return NextResponse.json({ error: 'Claim signing not configured' }, { status: 503 })
    }

    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const recipient = String(body?.recipient ?? '').trim()
    const challengeId = String(body?.challengeId ?? '').trim()

    const limited = await enforceApiRateLimit({
      request,
      scope: 'trash-athlete-claim',
      maxRequests: 10,
      windowMs: 60_000,
      walletAddress: recipient || null,
    })
    if (!limited.ok) return limited.response

    if (!isAddress(recipient)) {
      return NextResponse.json({ error: 'Invalid or missing recipient address' }, { status: 400 })
    }

    const wallet = await findWalletMetadata(userId)
    if (!wallet) {
      return NextResponse.json({ error: 'No wallet on this account' }, { status: 400 })
    }

    const allowedWallets = new Set([
      wallet.smartAccountAddress.toLowerCase(),
      wallet.address.toLowerCase(),
    ])

    let challenge = challengeId ? await getTrashAthleteById(challengeId) : null
    if (!challenge) {
      challenge =
        (await findClaimableTrashAthleteBonus(wallet.smartAccountAddress)) ||
        (await findClaimableTrashAthleteBonus(wallet.address))
    }
    if (!challenge) {
      return NextResponse.json({ error: 'No approved unclaimed Trash Athlete bonus' }, { status: 404 })
    }
    if (challenge.status !== 'APPROVED' || challenge.bonusCdcuClaimed) {
      return NextResponse.json({ error: 'Bonus not claimable' }, { status: 400 })
    }
    if (!allowedWallets.has(challenge.walletAddress.toLowerCase())) {
      return NextResponse.json({ error: 'Challenge does not belong to this account' }, { status: 403 })
    }

    // Prefer minting to the signer EOA (same as airdrop / gardens.fund), fall back to request recipient if it matches.
    const mintTo = allowedWallets.has(recipient.toLowerCase())
      ? (recipient as Address)
      : (wallet.address as Address)

    const amountWei = parseEther(challenge.bonusCdcuAmount || TRASH_ATHLETE_BONUS_CDCU)
    const nonce = BigInt(`0x${randomBytes(16).toString('hex')}`)
    const expiry = Math.floor(Date.now() / 1000) + MAX_EXPIRY_SECONDS

    const signed = await signClaimVaultClaim(
      {
        recipient: mintTo,
        amount: amountWei,
        category: CLAIM_CATEGORY.CommunityIncentives,
        nonce,
        expiry,
      },
      chainId,
      claimVaultAddress,
      privateKey
    )

    return NextResponse.json({
      challengeId: challenge.id,
      recipient: signed.recipient,
      amount: signed.amount.toString(),
      category: signed.category,
      nonce: signed.nonce.toString(),
      expiry: signed.expiry,
      v: signed.v,
      r: signed.r,
      s: signed.s,
      amountCdcu: challenge.bonusCdcuAmount || TRASH_ATHLETE_BONUS_CDCU,
      levelTarget: challenge.levelTarget,
      dcuPointsAmount: challenge.dcuPointsAmount,
    })
  } catch (e) {
    logApiError('trash-athlete/claim-request', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Claim request failed') }, { status: 500 })
  }
}

/** Record onchain claim success so the bonus cannot be signed again. */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const challengeId = String(body?.challengeId ?? '').trim()
    const txHash = String(body?.txHash ?? '').trim()
    if (!challengeId || !txHash) {
      return NextResponse.json({ error: 'challengeId and txHash required' }, { status: 400 })
    }

    const wallet = await findWalletMetadata(userId)
    if (!wallet) {
      return NextResponse.json({ error: 'No wallet on this account' }, { status: 400 })
    }

    const challenge = await getTrashAthleteById(challengeId)
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    const allowed = new Set([
      wallet.smartAccountAddress.toLowerCase(),
      wallet.address.toLowerCase(),
    ])
    if (!allowed.has(challenge.walletAddress.toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await markTrashAthleteBonusClaimed({ id: challengeId, txHash })
    return NextResponse.json({ success: true })
  } catch (e) {
    logApiError('trash-athlete/claim-record', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Failed to record claim') }, { status: 500 })
  }
}
