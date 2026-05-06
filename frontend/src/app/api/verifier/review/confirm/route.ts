/**
 * POST /api/verifier/review/confirm
 *
 * Confirms on-chain grantRole transaction and only then marks DB status APPROVED.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, defineChain, http, type Address } from 'viem'
import {
  getApplicationById,
  lockApplication,
  logAuditEvent,
  unlockApplication,
  updateApplicationStatus,
} from '@/lib/supabase/applications'
import {
  REQUIRED_CHAIN_ID,
  REQUIRED_RPC_URL,
  CONTRACT_ADDRESSES,
  REQUIRED_CHAIN_NAME,
} from '@/lib/blockchain/chain-constants'
import { isAdminOnChain } from '@/lib/verifier/admin-check'
import { validateInput, VerifierReviewConfirmSchema } from '@/lib/validation/verifier-schemas'

const ROLE_CHECK_ABI = [
  {
    type: 'function',
    name: 'VERIFIER_ROLE',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'hasRole',
    stateMutability: 'view',
    inputs: [
      { type: 'bytes32', name: 'role' },
      { type: 'address', name: 'account' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

const requiredChain = defineChain({
  id: REQUIRED_CHAIN_ID,
  name: REQUIRED_CHAIN_NAME,
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: { default: { http: [REQUIRED_RPC_URL] } },
})

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let applicationId: string | null = null
  let locked = false

  try {
    const body = await request.json()
    const validation = validateInput(VerifierReviewConfirmSchema, body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.errors.flatten() },
        { status: 400 }
      )
    }

    const { applicationId: appId, txHash } = validation.data
    applicationId = appId

    const app = await getApplicationById(applicationId)
    if (!app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    locked = await lockApplication(applicationId)
    if (!locked) {
      return NextResponse.json(
        { error: 'Application is being processed. Try again.' },
        { status: 409 }
      )
    }

    const lockedApp = await getApplicationById(applicationId)
    if (!lockedApp) {
      return NextResponse.json({ error: 'Application not found after lock' }, { status: 404 })
    }

    if (lockedApp.status !== 'PENDING_ONCHAIN' && lockedApp.status !== 'PENDING') {
      return NextResponse.json(
        {
          error: `Application is not waiting on on-chain confirmation (${lockedApp.status.toLowerCase()})`,
        },
        { status: 409 }
      )
    }

    if (!CONTRACT_ADDRESSES.VERIFICATION) {
      return NextResponse.json(
        { error: 'Submission contract address not configured on server' },
        { status: 500 }
      )
    }

    const client = createPublicClient({
      chain: requiredChain,
      transport: http(REQUIRED_RPC_URL),
    })

    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` })
    if (receipt.status !== 'success') {
      return NextResponse.json(
        { error: 'On-chain transaction did not succeed. Cannot confirm approval.' },
        { status: 409 }
      )
    }

    const tx = await client.getTransaction({ hash: txHash as `0x${string}` })
    const reviewedBy = tx.from.toLowerCase()
    const isAdmin = await isAdminOnChain(reviewedBy)
    if (!isAdmin) {
      await logAuditEvent(applicationId, 'UNAUTHORIZED_CONFIRM_ATTEMPT', reviewedBy, {
        reason: 'Transaction sender is not admin',
        txHash,
      })
      return NextResponse.json(
        { error: 'Unauthorized. Transaction sender does not have admin role.' },
        { status: 403 }
      )
    }

    const verifierRole = (await client.readContract({
      address: CONTRACT_ADDRESSES.VERIFICATION as Address,
      abi: ROLE_CHECK_ABI,
      functionName: 'VERIFIER_ROLE',
    })) as `0x${string}`

    const hasVerifierRole = (await client.readContract({
      address: CONTRACT_ADDRESSES.VERIFICATION as Address,
      abi: ROLE_CHECK_ABI,
      functionName: 'hasRole',
      args: [verifierRole, lockedApp.address as Address],
    })) as boolean

    if (!hasVerifierRole) {
      return NextResponse.json(
        {
          error:
            'On-chain role check failed. Applicant does not have VERIFIER_ROLE after this transaction.',
        },
        { status: 409 }
      )
    }

    const updated = await updateApplicationStatus(
      applicationId,
      'APPROVED',
      reviewedBy,
      'Approval confirmed on-chain',
      txHash
    )

    await logAuditEvent(applicationId, 'approval_confirmed', reviewedBy, {
      txHash,
      applicantAddress: lockedApp.address,
      blockNumber: receipt.blockNumber.toString(),
      transactionIndex: receipt.transactionIndex,
    })

    return NextResponse.json({
      success: true,
      application: updated,
      txHash,
      message: 'Application approved after successful on-chain verifier role confirmation.',
    })
  } catch (error) {
    console.error('Error in POST /api/verifier/review/confirm:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    if (applicationId && locked) {
      await unlockApplication(applicationId)
    }
  }
}
