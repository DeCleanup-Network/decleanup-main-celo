import 'server-only'
import type { Hex } from 'viem'
import { prisma } from '@/lib/db/prisma'
import { consumeWalletNonce } from '@/lib/auth/wallet-challenge-store'
import { verifyWalletSignMessage } from '@/lib/auth/siwe'

export async function authorizeWalletCredentials(credentials: Record<string, unknown> | undefined) {
  const message = credentials?.message
  const signature = credentials?.signature
  if (typeof message !== 'string' || typeof signature !== 'string') return null

  const fields = await verifyWalletSignMessage(message, signature as Hex)
  if (!fields) return null
  if (!(await consumeWalletNonce(fields.address, fields.nonce))) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[auth] wallet sign-in: nonce missing or expired — try Sign in again')
    }
    return null
  }

  const walletId = fields.address.toLowerCase()
  const email = `${walletId}@wallet.local`

  let user
  try {
    user = await prisma.user.upsert({
      where: { email },
      create: { email, name: fields.address },
      update: { name: fields.address },
    })
  } catch (e) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[auth] wallet sign-in: database error', e)
    }
    return null
  }

  await prisma.account.upsert({
    where: {
      provider_providerAccountId: { provider: 'wallet', providerAccountId: walletId },
    },
    create: {
      userId: user.id,
      type: 'credentials',
      provider: 'wallet',
      providerAccountId: walletId,
    },
    update: {},
  })

  return { id: user.id, email: user.email, name: user.name }
}
