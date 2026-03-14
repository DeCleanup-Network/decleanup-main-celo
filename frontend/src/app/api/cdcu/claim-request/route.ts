/**
 * POST /api/cdcu/claim-request
 *
 * Request a signed $cDCU claim for the given recipient.
 * Backend reads on-chain eligibility (DCURewardManager reward stats), computes claimable amount,
 * signs EIP-712 Claim, and returns signature + params for the user to submit via ClaimVault.claim().
 *
 * Body: { recipient: string } (wallet address)
 * Returns: { recipient, amount, category, nonce, expiry, v, r, s } or 400/500.
 */

import { NextResponse } from 'next/server'
import { type Address, isAddress } from 'viem'
import { randomBytes } from 'crypto'
import {
  getEligibilityAndClaimable,
  signClaimVaultClaim,
  loadIssuedStore,
  saveIssuedStore,
  getPendingAmount,
  setPendingAmount,
  CLAIM_CATEGORY,
} from '@/lib/cdcu/claim-signing'

const MAX_EXPIRY_SECONDS = 7 * 24 * 60 * 60 // 7 days (backend policy; contract allows up to 30)

/** Ensure private key is 0x-prefixed hex (viem expects this). */
function normalizePrivateKey(raw: string | undefined): `0x${string}` | undefined {
  if (!raw || typeof raw !== 'string') return undefined
  const trimmed = raw.trim().replace(/^0x/i, '')
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) return undefined
  return `0x${trimmed}` as `0x${string}`
}

export async function POST(request: Request) {
  try {
    const privateKey = normalizePrivateKey(process.env.CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY)
    const claimVaultAddress = process.env.NEXT_PUBLIC_CLAIMVAULT_ADDRESS as Address | undefined
    const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 11142220)

    if (!privateKey || !claimVaultAddress || !isAddress(claimVaultAddress)) {
      console.error('ClaimVault config missing: CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY or NEXT_PUBLIC_CLAIMVAULT_ADDRESS')
      return NextResponse.json(
        { error: 'Claim signing not configured' },
        { status: 503 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const recipient = (body?.recipient ?? '').trim()
    if (!recipient || !isAddress(recipient)) {
      return NextResponse.json(
        { error: 'Invalid or missing recipient address' },
        { status: 400 }
      )
    }

    const { totalPointsWei, eligible, claimableCapWei } = await getEligibilityAndClaimable(recipient as Address)
    if (!eligible) {
      return NextResponse.json(
        { error: 'Eligibility requires 50 DCU points. Keep earning to unlock $cDCU claims.' },
        { status: 400 }
      )
    }

    const store = loadIssuedStore()
    const totalIssued = BigInt(store[recipient.toLowerCase()] ?? '0')
    const pending = getPendingAmount(store, recipient)
    const claimable = claimableCapWei > totalIssued + pending ? claimableCapWei - totalIssued - pending : 0n

    if (claimable === 0n) {
      return NextResponse.json(
        { error: 'No claimable $cDCU left for this address (already claimed for your current points).' },
        { status: 400 }
      )
    }

    const nonce = BigInt('0x' + randomBytes(16).toString('hex'))
    const expiry = Math.floor(Date.now() / 1000) + MAX_EXPIRY_SECONDS

    const payload = {
      recipient: recipient as Address,
      amount: claimable,
      category: CLAIM_CATEGORY.CleanupCampaign,
      nonce,
      expiry,
    }

    const signed = await signClaimVaultClaim(
      payload,
      chainId,
      claimVaultAddress,
      privateKey
    )

    setPendingAmount(store, recipient, claimable)
    saveIssuedStore(store)

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
    console.error('Claim request error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Claim request failed' },
      { status: 500 }
    )
  }
}
