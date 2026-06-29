import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { type Address, isAddress, parseEther } from 'viem'
import { CLAIM_CATEGORY, signClaimVaultClaim } from '@/lib/cdcu/claim-signing'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { getAirdropAllocation } from '@/lib/airdrop/manual-allocations'
import {
  clearAirdropPending,
  getAirdropPending,
  hasAirdropClaimed,
  setAirdropPending,
} from '@/lib/airdrop/store'
import { enforceApiRateLimit } from '@/lib/server/rate-limit'
import { apiErrorMessage, logApiError } from '@/lib/server/api-error'

const MAX_EXPIRY_SECONDS = 7 * 24 * 60 * 60

function normalizePrivateKey(raw: string | undefined): `0x${string}` | undefined {
  if (!raw || typeof raw !== 'string') return undefined
  const trimmed = raw.trim().replace(/^0x/i, '')
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) return undefined
  return `0x${trimmed}` as `0x${string}`
}

export async function POST(request: NextRequest) {
  try {
    const privateKey = normalizePrivateKey(process.env.CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY)
    const claimVaultAddress = process.env.NEXT_PUBLIC_CLAIMVAULT_ADDRESS as Address | undefined
    const chainId = REQUIRED_CHAIN_ID
    if (!privateKey || !claimVaultAddress || !isAddress(claimVaultAddress)) {
      return NextResponse.json({ error: 'Claim signing not configured' }, { status: 503 })
    }

    const body = await request.json().catch(() => ({}))
    const recipient = (body?.recipient ?? '').trim()

    const limited = await enforceApiRateLimit({
      request,
      scope: 'airdrop-claim',
      maxRequests: 15,
      windowMs: 60_000,
      walletAddress: recipient || null,
    })
    if (!limited.ok) return limited.response

    if (!isAddress(recipient)) {
      return NextResponse.json({ error: 'Invalid or missing recipient address' }, { status: 400 })
    }

    const allocation = getAirdropAllocation(recipient)
    if (!allocation) {
      return NextResponse.json({ error: 'No airdrop allocation for this wallet' }, { status: 404 })
    }

    if (await hasAirdropClaimed(recipient)) {
      return NextResponse.json({ error: 'Airdrop was already claimed for this wallet' }, { status: 400 })
    }

    const amountWei = parseEther(allocation.amountCdcu)
    let pendingWei = await getAirdropPending(recipient)
    if (pendingWei >= amountWei && amountWei > 0n) {
      await clearAirdropPending(recipient)
      pendingWei = 0n
    }
    const claimableWei = amountWei > pendingWei ? amountWei - pendingWei : 0n
    if (claimableWei <= 0n) {
      return NextResponse.json({ error: 'No claimable amount available right now' }, { status: 400 })
    }

    const nonce = BigInt(`0x${randomBytes(16).toString('hex')}`)
    const expiry = Math.floor(Date.now() / 1000) + MAX_EXPIRY_SECONDS

    const signed = await signClaimVaultClaim(
      {
        recipient: recipient as Address,
        amount: claimableWei,
        category: CLAIM_CATEGORY.PublicDistribution,
        nonce,
        expiry,
      },
      chainId,
      claimVaultAddress,
      privateKey
    )

    await setAirdropPending(recipient, claimableWei)

    return NextResponse.json({
      recipient: signed.recipient,
      amount: signed.amount.toString(),
      category: signed.category,
      nonce: signed.nonce.toString(),
      expiry: signed.expiry,
      v: signed.v,
      r: signed.r,
      s: signed.s,
    })
  } catch (e) {
    logApiError('airdrop/claim-request', e)
    return NextResponse.json(
      { error: apiErrorMessage(e, 'Claim request failed') },
      { status: 500 }
    )
  }
}
