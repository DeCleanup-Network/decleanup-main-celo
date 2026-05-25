import { NextResponse } from 'next/server'
import { getAddress, isAddress } from 'viem'
import { issueWalletNonce } from '@/lib/auth/wallet-challenge-store'
import { buildWalletSignMessage } from '@/lib/auth/siwe'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('address')
  if (!raw || !isAddress(raw)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
  }

  const address = getAddress(raw)
  const host = request.headers.get('host') ?? 'localhost:3000'
  const domain = host.split(':')[0]
  const proto = domain === 'localhost' || domain.endsWith('.local') ? 'http' : 'https'
  const uri = `${proto}://${host}`
  const nonce = await issueWalletNonce(address)
  const message = buildWalletSignMessage({
    domain,
    uri,
    address,
    chainId: REQUIRED_CHAIN_ID,
    nonce,
  })

  return NextResponse.json({ message, nonce })
}
