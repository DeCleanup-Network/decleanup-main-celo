import { NextResponse } from 'next/server'
import { isAddress, parseEther } from 'viem'
import { getAirdropAllocation } from '@/lib/airdrop/manual-allocations'
import { getAirdropPending, hasAirdropClaimed, loadAirdropStore } from '@/lib/airdrop/store'

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

    const store = loadAirdropStore()
    const claimed = hasAirdropClaimed(store, address)
    const totalWei = parseEther(allocation.amountCdcu)
    const pendingWei = getAirdropPending(store, address)
    const claimableWei = claimed ? 0n : totalWei > pendingWei ? totalWei - pendingWei : 0n

    return NextResponse.json({
      eligible: true,
      walletAddress: allocation.walletAddress,
      amountCdcu: allocation.amountCdcu,
      amountWei: totalWei.toString(),
      claimableWei: claimableWei.toString(),
      category: allocation.category,
      label: allocation.label,
      claimed,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to check airdrop allocation' },
      { status: 500 }
    )
  }
}
