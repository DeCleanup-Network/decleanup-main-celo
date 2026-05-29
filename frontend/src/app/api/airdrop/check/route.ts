import { NextResponse } from 'next/server'
import { isAddress, parseEther } from 'viem'
import { getAirdropAllocation } from '@/lib/airdrop/manual-allocations'
import { hasAirdropClaimOnChain } from '@/lib/airdrop/onchain-claimed'
import { clearAirdropPending, getAirdropPending, hasAirdropClaimed, markAirdropClaimed } from '@/lib/airdrop/store'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')?.trim() ?? ''
    if (!isAddress(address)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
    }

    const allocation = getAirdropAllocation(address)
    if (!allocation) {
      return NextResponse.json({ eligible: false })
    }

    let claimed = await hasAirdropClaimed(address)
    if (!claimed && (await hasAirdropClaimOnChain(address as `0x${string}`))) {
      await markAirdropClaimed(address)
      claimed = true
    }
    const totalWei = parseEther(allocation.amountCdcu)
    let pendingWei = await getAirdropPending(address)

    // claim-request reserves pending before the tx lands; clear stale locks so users can retry
    if (!claimed && pendingWei >= totalWei && totalWei > 0n) {
      await clearAirdropPending(address)
      pendingWei = 0n
    }

    const claimableWei = claimed ? 0n : totalWei > pendingWei ? totalWei - pendingWei : 0n
    const pastContributorBadge =
      claimed && allocation.category === 'past_contributor'

    return NextResponse.json({
      eligible: true,
      walletAddress: allocation.walletAddress,
      amountCdcu: allocation.amountCdcu,
      amountWei: totalWei.toString(),
      claimableWei: claimableWei.toString(),
      category: allocation.category,
      label: allocation.label,
      claimed,
      pastContributorBadge,
      stalePendingCleared: !claimed && pendingWei === 0n,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to check airdrop allocation' },
      { status: 500 }
    )
  }
}
