import { NextRequest, NextResponse } from 'next/server'
import type { Address } from 'viem'
import { requireSessionUserId } from '@/lib/auth/require-session'
import { enforceWalletApiRateLimit } from '@/lib/server/wallet-api-rate-limit'
import { getWalletBootstrapState } from '@/lib/wallet/bootstrap'
import { getSmartAccountBalance } from '@/lib/smart-account/server'
import { isPimlicoConfigured } from '@/lib/paymaster/pimlico'
import { syncWalletSchema } from '@/lib/aa/validation'
import { deleteWalletByUserId, findWalletByUserId, upsertWalletMetadata } from '@/lib/wallet/repository'
import { assertAddress } from '@/lib/smart-account/server'

export const dynamic = 'force-dynamic'

/** Read wallet metadata + balance (no private keys). */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId()
    const limited = enforceWalletApiRateLimit(request, 'aa-wallet', userId)
    if (!limited.ok) return limited.response
    const state = await getWalletBootstrapState(userId)

    const row = await findWalletByUserId(userId)

    if (!state.hasWallet || !state.smartAccountAddress) {
      return NextResponse.json({
        ok: true,
        hasWallet: false,
        eoaAddress: null,
        smartAccountAddress: null,
        chainId: null,
        balance: null,
        encryptedBlob: null,
        gaslessEnabled: state.gaslessEnabled,
      })
    }

    let balance: string | null = null
    try {
      balance = await Promise.race([
        getSmartAccountBalance(state.smartAccountAddress as Address),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('balance timeout')), 12_000)
        ),
      ])
    } catch {
      balance = null
    }

    return NextResponse.json({
      ok: true,
      hasWallet: true,
      eoaAddress: state.address,
      smartAccountAddress: state.smartAccountAddress,
      chainId: state.chainId,
      balance,
      encryptedBlob: row?.encryptedBlob ?? null,
      gaslessEnabled: state.gaslessEnabled,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load wallet'
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[aa/wallet GET]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * Sync client-encrypted wallet blob + addresses. Server stores opaque JSON only.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId()
    const limited = enforceWalletApiRateLimit(request, 'aa-wallet', userId)
    if (!limited.ok) return limited.response
    const body = await request.json()
    const parsed = syncWalletSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { address, smartAccountAddress, encryptedBlob, chainId } = parsed.data
    const meta = await upsertWalletMetadata({
      userId,
      address: assertAddress(address),
      smartAccountAddress: assertAddress(smartAccountAddress),
      encryptedBlob,
      chainId,
    })

    return NextResponse.json({
      ok: true,
      eoaAddress: meta.address,
      smartAccountAddress: meta.smartAccountAddress,
      chainId: meta.chainId,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sync failed'
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[aa/wallet POST]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Reset wallet metadata for the signed-in account (used by destructive recovery). */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireSessionUserId()
    const limited = enforceWalletApiRateLimit(request, 'aa-wallet', userId)
    if (!limited.ok) return limited.response

    await deleteWalletByUserId(userId)
    return NextResponse.json({ ok: true, reset: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Reset failed'
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[aa/wallet DELETE]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
