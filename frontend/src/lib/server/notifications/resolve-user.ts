import 'server-only'
import { prisma } from '@/lib/db/prisma'
import { isAddress } from 'viem'

export async function resolveUserIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized || !normalized.includes('@')) return null
  const user = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: 'insensitive' } },
    select: { id: true },
  })
  return user?.id ?? null
}

export async function resolveUserIdByWallet(wallet: string): Promise<string | null> {
  const addr = wallet.trim().toLowerCase()
  if (!isAddress(addr)) return null

  const row = await prisma.userWallet.findFirst({
    where: {
      OR: [
        { address: { equals: addr, mode: 'insensitive' } },
        { smartAccountAddress: { equals: addr, mode: 'insensitive' } },
      ],
    },
    select: { userId: true },
  })
  if (row?.userId) return row.userId

  const account = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: 'wallet',
        providerAccountId: addr,
      },
    },
    select: { userId: true },
  })
  if (account?.userId) return account.userId

  const walletLocal = await prisma.user.findUnique({
    where: { email: `${addr}@wallet.local` },
    select: { id: true },
  })
  return walletLocal?.id ?? null
}

export async function resolveUserEmail(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, notifyEmail: true },
  })
  if (!user?.email || user.notifyEmail === false) return null
  // Synthetic SIWE accounts have no real mailbox
  if (user.email.toLowerCase().endsWith('@wallet.local')) return null
  return user.email
}

export function userHasRealEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return !email.toLowerCase().endsWith('@wallet.local')
}
