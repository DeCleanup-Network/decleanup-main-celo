/**
 * POST /api/verifier/apply
 * 
 * User applies to become verifier
 */

import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, defineChain, http, type Address } from 'viem'
import { checkEligibility } from '@/lib/verifier/eligibility'
import { createApplication, hasPendingApplication, hasApprovedApplication } from '@/lib/supabase/applications'
import { VerifierMetrics } from '@/lib/verifier/types'
import { validateInput, VerifierApplySchema } from '@/lib/validation/verifier-schemas'
import {
  CONTRACT_ADDRESSES,
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
  REQUIRED_RPC_URL,
} from '@/lib/blockchain/chain-constants'

export const dynamic = 'force-dynamic'

function verifierApplyStorageConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim()
  return Boolean(url && key)
}

const requiredChain = defineChain({
  id: REQUIRED_CHAIN_ID,
  name: REQUIRED_CHAIN_NAME,
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: { default: { http: [REQUIRED_RPC_URL] } },
})

const publicClient = createPublicClient({
  chain: requiredChain,
  transport: http(REQUIRED_RPC_URL),
})

const IMPACT_PRODUCT_LEVEL_ABI = [
  {
    type: 'function',
    name: 'getUserNFTData',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'impact', type: 'uint256' },
      { name: 'level', type: 'uint256' },
    ],
  },
] as const

const REWARD_MANAGER_STATS_ABI_8 = [
  {
    type: 'function',
    name: 'getUserRewardStats',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'currentBalance', type: 'uint256' },
      { name: 'totalEarned', type: 'uint256' },
      { name: 'totalClaimed', type: 'uint256' },
      { name: 'claimRewardsAmount', type: 'uint256' },
      { name: 'streakRewardsAmount', type: 'uint256' },
      { name: 'referralRewardsAmount', type: 'uint256' },
      { name: 'impactReportRewardsAmount', type: 'uint256' },
      { name: 'recyclablesRewardsAmount', type: 'uint256' },
    ],
  },
] as const

const REWARD_MANAGER_STATS_ABI_7 = [
  {
    type: 'function',
    name: 'getUserRewardStats',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'currentBalance', type: 'uint256' },
      { name: 'totalEarned', type: 'uint256' },
      { name: 'totalClaimed', type: 'uint256' },
      { name: 'claimRewardsAmount', type: 'uint256' },
      { name: 'streakRewardsAmount', type: 'uint256' },
      { name: 'referralRewardsAmount', type: 'uint256' },
      { name: 'impactReportRewardsAmount', type: 'uint256' },
    ],
  },
] as const

const SUBMISSION_READ_ABI = [
  {
    type: 'function',
    name: 'getSubmissionsByUser',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    type: 'function',
    name: 'getSubmissionDetails',
    stateMutability: 'view',
    inputs: [{ name: 'submissionId', type: 'uint256' }],
    outputs: [
      {
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'submitter', type: 'address' },
          { name: 'dataURI', type: 'string' },
          { name: 'beforePhotoHash', type: 'string' },
          { name: 'afterPhotoHash', type: 'string' },
          { name: 'impactFormDataHash', type: 'string' },
          { name: 'latitude', type: 'int256' },
          { name: 'longitude', type: 'int256' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'approver', type: 'address' },
          { name: 'processedTimestamp', type: 'uint256' },
          { name: 'rewarded', type: 'bool' },
          { name: 'feePaid', type: 'uint256' },
          { name: 'feeRefunded', type: 'bool' },
          { name: 'hasImpactForm', type: 'bool' },
          { name: 'hasRecyclables', type: 'bool' },
          { name: 'recyclablesPhotoHash', type: 'string' },
          { name: 'recyclablesReceiptHash', type: 'string' },
        ],
        type: 'tuple',
      },
    ],
  },
] as const

async function getOnchainVerifierMetrics(address: string): Promise<VerifierMetrics> {
  const addr = address as Address
  let level = 0
  if (CONTRACT_ADDRESSES.IMPACT_PRODUCT) {
    try {
      const nftData = (await publicClient.readContract({
        address: CONTRACT_ADDRESSES.IMPACT_PRODUCT as Address,
        abi: IMPACT_PRODUCT_LEVEL_ABI,
        functionName: 'getUserNFTData',
        args: [addr],
      })) as [bigint, bigint, bigint]
      level = Number(nftData[2])
    } catch {
      level = 0
    }
  }

  let totalEarned = 0
  if (CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR) {
    try {
      const rewardStats8 = (await publicClient.readContract({
        address: CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR as Address,
        abi: REWARD_MANAGER_STATS_ABI_8,
        functionName: 'getUserRewardStats',
        args: [addr],
      })) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]
      totalEarned = Number(rewardStats8[1]) / 1e18
    } catch {
      try {
        const rewardStats7 = (await publicClient.readContract({
          address: CONTRACT_ADDRESSES.REWARD_DISTRIBUTOR as Address,
          abi: REWARD_MANAGER_STATS_ABI_7,
          functionName: 'getUserRewardStats',
          args: [addr],
        })) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint]
        totalEarned = Number(rewardStats7[1]) / 1e18
      } catch {
        totalEarned = 0
      }
    }
  }

  let submissions: bigint[] = []
  if (CONTRACT_ADDRESSES.VERIFICATION) {
    try {
      submissions = (await publicClient.readContract({
        address: CONTRACT_ADDRESSES.VERIFICATION as Address,
        abi: SUBMISSION_READ_ABI,
        functionName: 'getSubmissionsByUser',
        args: [addr],
      })) as bigint[]
    } catch {
      submissions = []
    }
  }

  let approvedCleanups = 0
  for (const submissionId of submissions) {
    try {
      const details = (await publicClient.readContract({
        address: CONTRACT_ADDRESSES.VERIFICATION as Address,
        abi: SUBMISSION_READ_ABI,
        functionName: 'getSubmissionDetails',
        args: [submissionId],
      })) as { status: number | bigint }

      const status = Number(details.status)
      // Submission status enum in contract: 1 = Approved, 2 = Rejected
      if (status === 1) {
        approvedCleanups++
      }
    } catch (e) {
      console.warn(`Failed to fetch cleanup ${submissionId.toString()} for ${address}:`, e)
    }
  }

  return {
    level,
    // Eligibility uses earned points, not current transferable token balance.
    dcuBalance: totalEarned,
    approvedCleanups,
  }
}

export async function POST(request: NextRequest) {
  if (!verifierApplyStorageConfigured()) {
    return NextResponse.json(
      {
        error: 'Verifier applications storage is not configured',
        hint: 'Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local (server-side service role, not the anon key). Apply the verifier_applications migration in Supabase if the table is missing.',
      },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    // STEP 1: Validate input with Zod
    const validation = validateInput(VerifierApplySchema, body)
    
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.errors.flatten(),
        },
        { status: 400 }
      )
    }

    const { address, metrics } = validation.data

    // STEP 2: Check if already has pending application
    const hasPending = await hasPendingApplication(address)
    if (hasPending) {
      return NextResponse.json(
        { error: 'You already have a pending application' },
        { status: 409 }
      )
    }

    // STEP 3: Check if already approved
    const hasApproved = await hasApprovedApplication(address)
    if (hasApproved) {
      return NextResponse.json(
        { error: 'You are already an approved verifier' },
        { status: 409 }
      )
    }

    // STEP 4: Recompute metrics on-chain server-side (do not trust client payload for role gating)
    const onchainMetrics = await getOnchainVerifierMetrics(address)
    const providedMetrics = metrics as VerifierMetrics
    if (
      providedMetrics.level !== onchainMetrics.level ||
      Math.abs(providedMetrics.dcuBalance - onchainMetrics.dcuBalance) > 0.01 ||
      providedMetrics.approvedCleanups !== onchainMetrics.approvedCleanups
    ) {
      console.warn('Verifier apply metrics mismatch (client vs on-chain):', {
        address,
        client: providedMetrics,
        onchain: onchainMetrics,
      })
    }

    const eligibility = checkEligibility(onchainMetrics)
    if (!eligibility.eligible) {
      return NextResponse.json(
        {
          error: 'Not eligible to apply',
          reasons: eligibility.reasons,
          metrics: onchainMetrics,
        },
        { status: 403 }
      )
    }

    // STEP 5: Create application in Supabase
    const application = await createApplication(address)

    console.log(`✅ Verifier application created: ${application.id} for ${address}`)

    return NextResponse.json(
      {
        success: true,
        application,
        message: 'Application submitted successfully. Admins will review your application.',
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Error in POST /api/verifier/apply:', error)
    const message = error instanceof Error ? error.message : String(error)
    const isMissingSupabase = message.includes('Missing Supabase server credentials')
    const isCreateFailure = message.startsWith('Failed to create application:')
    if (isMissingSupabase) {
      return NextResponse.json(
        {
          error: message,
          hint: 'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.',
        },
        { status: 503 }
      )
    }
    if (isCreateFailure) {
      return NextResponse.json(
        {
          error: 'Could not save verifier application',
          hint: message.replace(/^Failed to create application:\s*/, ''),
        },
        { status: 502 }
      )
    }
    return NextResponse.json(
      {
        error: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' ? { detail: message } : {}),
      },
      { status: 500 }
    )
  }
}
